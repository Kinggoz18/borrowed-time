"""Street, plaza and scenery tiles: flush paved streets per era with kerbs, a dirt track for the colony, plazas, trees, bushes, lamp posts.
Streets are 16-mask autotiles over the lot diamond (96 x 50 px): bit 1 = arm towards +a (screen down-right), 2 = -a, 4 = +b (down-left), 8 = -b.
Every tile is the era's lawn with a band drawn from the L-infinity distance to the street skeleton in lot-local coordinates, so
neighbouring tiles join exactly at the shared edge. Deterministic."""
import numpy as np
import terrain as T
import era_ground as EG
from pixlib import hsh, INK, bayer, outline, LOT_W, LOT_H

FW, FH = T.FW, T.FH
ANCHOR = (T.GANCHOR[0], T.GANCHOR[1])
HW = 0.25          # half width of the carriageway in lot units
KERB = 0.035       # kerb stones
SW = 0.40          # half width including the pavement

yy, xx = np.mgrid[0:FH, 0:FW]
U = (xx + 0.5 - 48) / 48.0
V = (yy + 0.5 - 49) / 24.0
A = (U + V + 2) / 2          # lot-local a, b of every pixel centre
B = (V + 2 - U) / 2
MASK = T.diamond_mask(FW, FH, FW / 2, FH / 2)


def skeleton_dist(mask, centre=True):
    """L-infinity distance from every pixel to the street skeleton (centre point plus one segment per arm)."""
    d = np.maximum(np.abs(A - 0.5), np.abs(B - 0.5)) if centre else np.full(A.shape, 9.0)
    arms = [(1, +1, 0), (2, -1, 0), (4, 0, +1), (8, 0, -1)]
    for bit, da, db in arms:
        if not mask & bit:
            continue
        if da:
            t = np.clip(A, 0.5, 1.0) if da > 0 else np.clip(A, 0.0, 0.5)
            dist = np.maximum(np.abs(A - t), np.abs(B - 0.5))
        else:
            t = np.clip(B, 0.5, 1.0) if db > 0 else np.clip(B, 0.0, 0.5)
            dist = np.maximum(np.abs(B - t), np.abs(A - 0.5))
        d = np.minimum(d, dist)
    return d


def pave(pal, mort, cell, salt, along=None):
    """Diamond lattice pavers (period divides 96 x 48 so the pattern is seamless), colour per paver from `pal`."""
    u = xx + 2 * yy
    v = xx - 2 * yy
    iu, iv = u // cell, v // cell
    n = 96 // cell
    out = np.zeros((FH, FW, 3), np.uint8)
    for y in range(FH):
        for x in range(FW):
            if u[y, x] % cell == 0 or v[y, x] % cell == 0:
                out[y, x] = mort
            else:
                r = hsh(int(iu[y, x]) % n, int(iv[y, x]) % n, salt)
                out[y, x] = pal[0] if r < 0.5 else pal[1] if r < 0.7 else pal[2] if r < 0.88 else pal[3]
    return out


def noise_fill(pal, seed, sigma=0.8):
    n = T.periodic_noise(T.PX, T.PY, seed, sigma)
    t = np.zeros((T.PY, T.PX, 3), np.uint8)
    idx = np.clip((n * len(pal)).astype(int), 0, len(pal) - 1)
    for i, c in enumerate(pal):
        t[idx == i] = c
    return T.tile_from_period(t)


# ----------------------------------------------------------------------------------------------------------- era looks
LOOKS = {
    # carriageway pavers, mortar, pavement pavers, pavement mortar, kerb, paver cell (px along the iso diagonals), pavement cell
    "village": dict(road=[(150, 130, 104), (164, 142, 112), (130, 112, 90), (176, 156, 124)], mort=(96, 80, 62), side=[(190, 176, 146), (200, 186, 156), (176, 162, 134), (208, 194, 164)], smort=(140, 126, 100), kerb=(214, 206, 188), kerb_dark=(120, 108, 90), cell=8, scell=16),
    "town": dict(road=[(150, 138, 120), (166, 152, 132), (134, 124, 110), (176, 164, 144)], mort=(92, 82, 70), side=[(214, 200, 176), (224, 212, 188), (204, 190, 166), (232, 220, 196)], smort=(160, 146, 124), kerb=(236, 230, 214), kerb_dark=(118, 106, 92), cell=8, scell=12),
    "city": dict(road=[(92, 94, 100), (82, 84, 92), (104, 106, 112), (72, 74, 82)], mort=(60, 62, 70), side=[(184, 184, 178), (196, 196, 190), (170, 170, 168), (206, 206, 200)], smort=(124, 124, 124), kerb=(226, 226, 220), kerb_dark=(70, 70, 76), cell=12, scell=12),
}
BRASS_T = (216, 180, 100)
DIRT_T = [(150, 118, 78), (136, 104, 66), (162, 130, 90), (112, 84, 54)]


def base_lawn(era, v):
    return EG.era_tile(era, "grass", v) if era != "colony" else T.ground_tile("grass", v)


def street_tile(era, mask, v):
    L = LOOKS[era]
    base = base_lawn(era, v)
    out = base.copy()
    d = skeleton_dist(mask)
    road = pave(L["road"], L["mort"], L["cell"], 40 + v)
    side = pave(L["side"], L["smort"], L["scell"], 50 + v)
    in_road = (d <= HW) & MASK
    in_kerb = (d > HW) & (d <= HW + KERB) & MASK
    in_side = (d > HW + KERB) & (d <= SW) & MASK
    out[in_side, :3] = side[in_side]
    out[in_road, :3] = road[in_road]
    # kerb: pale stones with a dark line towards the carriageway
    kerb_light = ((xx + yy) % 3) != 0
    out[in_kerb & kerb_light, :3] = L["kerb"]
    out[in_kerb & ~kerb_light, :3] = L["kerb_dark"]
    # pavement edge: one row of grass-fringing darker paver where it meets the lawn
    edge = (d > SW) & (d <= SW + 0.025) & MASK
    out[edge, :3] = (np.array(L["smort"]) * 0.8).astype(np.uint8)
    # hour-line ticks along the carriageway centre (the shadow walks down the street) in the City and Town
    if era in ("town", "city"):
        cen = skeleton_dist(mask)
        for bit, axis in ((1 | 2, "a"), (4 | 8, "b")):
            if (mask & bit) and not (mask & ~bit & 15 & ~(bit)):
                pass
        straight_a = (mask & 3) and not (mask & 12)
        straight_b = (mask & 12) and not (mask & 3)
        if straight_a or straight_b:
            along = A if straight_a else B
            across = B if straight_a else A
            dash = (np.floor(along * 6).astype(int) % 2 == 0) & (np.abs(across - 0.5) < 0.012) & in_road
            out[dash, :3] = BRASS_T if era == "town" else (232, 214, 150)
    return out


def track_tile(mask, v):
    """Colony dirt track: a worn narrow band, ruts, a dithered fringe into the grass (no kerb)."""
    out = T.ground_tile("grass", v).copy()
    d = skeleton_dist(mask)
    n = noise_fill(DIRT_T, 91 + v)
    core = (d <= 0.15) & MASK
    fringe = (d > 0.15) & (d <= 0.26) & MASK & (bayer(xx, yy) < np.clip((0.26 - d) / 0.11, 0, 1) * 0.9)
    out[core, :3] = n[core]
    out[fringe, :3] = n[fringe]
    rut = ((np.abs(d - 0.07) < 0.012) & core)
    out[rut, :3] = DIRT_T[3]
    pb = (T.hash_arr(xx, yy, 7 + v) < 0.012) & core
    out[pb, :3] = (160, 156, 146)
    return out


def plaza_tile(era, v=0):
    """A full paved diamond with an inlaid hour ring in brass and an outer kerb line; the plaza at the foot of a landmark."""
    key = "town" if era == "colony" else era
    L = LOOKS[key]
    out = base_lawn(era, v).copy()
    pav = pave(L["side"], L["smort"], L["cell"], 60 + v) if era != "colony" else None
    if era == "colony":
        pav = noise_fill([(190, 176, 140), (176, 162, 126), (204, 190, 154)], 97)
    out[MASK, :3] = pav[MASK]
    dd = np.maximum(np.abs(A - 0.5), np.abs(B - 0.5))
    ring = (np.abs(dd - 0.36) < 0.012) & MASK
    ring2 = (np.abs(dd - 0.2) < 0.01) & MASK
    out[ring, :3] = BRASS_T if era != "colony" else (150, 130, 96)
    out[ring2, :3] = (np.array(L["kerb_dark"]) if era != "colony" else (130, 112, 84))
    # twelve hour ticks on the outer ring
    for k in range(12):
        ang = k * np.pi / 6
        ca, cb = 0.5 + 0.43 * np.cos(ang), 0.5 + 0.43 * np.sin(ang)
        m = (np.abs(A - ca) < 0.02) & (np.abs(B - cb) < 0.02) & MASK
        out[m, :3] = BRASS_T if era != "colony" else (150, 130, 96)
    edge = (dd > 0.47) & MASK
    out[edge, :3] = L["kerb"] if era != "colony" else (210, 196, 160)
    return out


# ----------------------------------------------------------------------------------------------------------- trees, bushes, lamps
GREENS = [(38, 72, 40), (52, 92, 44), (72, 116, 52), (100, 142, 62), (136, 170, 84)]
TRUNK = [(60, 42, 28), (88, 62, 40), (116, 84, 54)]
BLOSSOM = [(238, 214, 84), (240, 236, 214), (214, 120, 140)]


def _disc_mask(w, h, cx, cy, rx, ry):
    yy2, xx2 = np.mgrid[0:h, 0:w]
    return ((xx2 + 0.5 - cx) / rx) ** 2 + ((yy2 + 0.5 - cy) / ry) ** 2 <= 1.0


def _shade(a, m, cx, cy, rx, ry, seed, tone0=1):
    """Fill mask m with 5 greens lit from the upper left, dithered between neighbouring steps."""
    h, w = a.shape[:2]
    yy2, xx2 = np.mgrid[0:h, 0:w]
    lx = -(xx2 + 0.5 - cx) / rx * 0.55 - (yy2 + 0.5 - cy) / ry * 0.75
    t = np.clip(0.5 + lx * 0.5, 0, 1) * 4.0
    t = t + (bayer(xx2, yy2) - 0.5) * 1.1 + (np.array([[hsh(x, y, seed) for x in range(w)] for y in range(h)]) - 0.5) * 0.7
    idx = np.clip(np.round(t).astype(int), 0, 4)
    for i in range(5):
        a[m & (idx == i), :3] = GREENS[i]
    a[m, 3] = 255


def tree(variant):
    """Four tree shapes, 40-46 px wide, anchored at the trunk foot (bottom centre)."""
    W, H = 48, 64
    a = np.zeros((H, W, 4), np.uint8)
    cx = W // 2
    trunk_h = (12, 9, 10, 14)[variant]
    # trunk
    for y in range(H - 2 - trunk_h, H - 1):
        for x in range(cx - 2, cx + 2):
            a[y, x] = (*TRUNK[0 if x == cx + 1 else 1 if x == cx else 2], 255)
    top = H - 2 - trunk_h
    if variant == 0:      # broad oak: three overlapping lobes
        for (ox, oy, rx, ry) in [(-8, -6, 12, 10), (8, -7, 12, 10), (0, -16, 14, 12), (0, -3, 15, 9)]:
            _shade(a, _disc_mask(W, H, cx + ox, top + oy, rx, ry), cx + ox, top + oy, rx, ry, 11 + variant)
    elif variant == 1:    # round shrub tree
        _shade(a, _disc_mask(W, H, cx, top - 9, 14, 13), cx, top - 9, 14, 13, 21)
    elif variant == 2:    # pine: stacked triangles
        for k, (yc, hw) in enumerate([(top - 2, 13), (top - 12, 10), (top - 21, 7), (top - 29, 4)]):
            m = np.zeros((H, W), bool)
            for y in range(max(0, yc - 11), yc + 1):
                half = hw * (y - (yc - 11)) / 11.0
                m[y, int(round(cx - half)):int(round(cx + half)) + 1] = True
            _shade(a, m & (a[..., 3] == 0), cx, yc - 5, hw, 8, 31 + k)
    else:                 # tall poplar
        _shade(a, _disc_mask(W, H, cx, top - 16, 8, 20), cx, top - 16, 8, 20, 41)
    a = outline(a)
    ys, xs = np.nonzero(a[..., 3])
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return a[y0:y1, x0:x1].copy(), (cx - x0, H - 1 - y0 + 0.0)


def bush(variant):
    W, H = 30, 20
    a = np.zeros((H, W, 4), np.uint8)
    cx = W // 2
    for (ox, oy, rx, ry) in [(-6, -5, 8, 6), (6, -5, 8, 6), (0, -8, 9, 7)][: 2 + (variant % 2)]:
        _shade(a, _disc_mask(W, H, cx + ox, H - 2 + oy, rx, ry) & (a[..., 3] == 0), cx + ox, H - 2 + oy, rx, ry, 51 + variant)
    if variant == 2:      # flowering
        for k in range(7):
            x, y = int(4 + hsh(k, 1, 5) * 22), int(4 + hsh(k, 2, 5) * 10)
            if a[y, x, 3]:
                a[y, x, :3] = BLOSSOM[k % 3]
    a = outline(a)
    ys, xs = np.nonzero(a[..., 3])
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return a[y0:y1, x0:x1].copy(), (cx - x0, H - 1 - y0 + 0.0)


def lamp(era):
    """A street lamp: iron post, glass lantern with a warm core (the game adds the halo at dusk)."""
    W, H = 14, 40
    a = np.zeros((H, W, 4), np.uint8)
    iron = [(36, 38, 48), (68, 72, 86), (98, 104, 118)]
    cx = 7
    for y in range(8, H - 1):
        a[y, cx - 1] = (*iron[2], 255)
        a[y, cx] = (*iron[1], 255)
        a[y, cx + 1] = (*iron[0], 255)
    for x in range(cx - 3, cx + 4):                    # foot
        a[H - 2, x] = (*iron[1], 255)
        a[H - 1, x] = (*iron[0], 255)
    for y in range(2, 8):                              # lantern
        for x in range(cx - 2, cx + 3):
            a[y, x] = (246, 206, 112, 255) if (x, y) != (cx, 5) else (255, 246, 196, 255)
    for x in range(cx - 3, cx + 4):
        a[1, x] = (*iron[0], 255)
        a[8, x] = (*iron[0], 255)
    if era == "city":
        a[0, cx - 1:cx + 2] = (*iron[1], 255)
    a = outline(a)
    ys, xs = np.nonzero(a[..., 3])
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return a[y0:y1, x0:x1].copy(), (cx - x0, H - 1 - y0 + 0.0)
