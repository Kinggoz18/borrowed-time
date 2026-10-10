"""Terrain: grass / lot / plot / road / sand diamonds, the island shore autotiles, sea tiles, cloud shadows."""
import numpy as np
from scipy import ndimage as ndi
from pixlib import LOT_W, LOT_H, STEP_X, STEP_Y, BAYER, INK, hsh, diamond_mask

GRASS = [(58, 94, 36), (72, 110, 40), (88, 128, 46), (104, 144, 52), (124, 160, 60)]
FLOWER = [(238, 214, 84), (240, 236, 214), (214, 120, 140)]
PEBBLE = [(132, 130, 122), (104, 102, 96), (160, 158, 148)]
DIRT = [(104, 74, 44), (124, 90, 54), (142, 104, 62), (86, 60, 36)]
SOIL = [(78, 52, 34), (92, 62, 40), (106, 74, 46), (64, 42, 28)]
SAND = [(214, 196, 148), (200, 180, 134), (226, 210, 164), (176, 156, 112)]
ROAD = [(150, 122, 86), (134, 108, 76), (166, 138, 100), (112, 90, 64)]
STONE_TOP = [(156, 154, 144), (140, 138, 130), (166, 163, 152), (128, 126, 120)]
STONE_SIDE = [(104, 102, 96), (92, 90, 86), (112, 108, 100)]
SEA = [(44, 128, 140), (36, 112, 126), (74, 164, 168), (150, 214, 206)]
SHALLOW1, SHALLOW2 = (112, 204, 196), (76, 170, 172)

FW, FH = LOT_W, LOT_H + 2          # ground frame size; diamond rows 1..LOT_H, anchor = front point
GANCHOR = (LOT_W // 2, LOT_H + 1)
PX, PY = LOT_W // 2, LOT_H // 2    # texture period: lattice step (48, 24)


def hash_arr(a, b, salt=0):
    x = (a.astype(np.uint64) * np.uint64(73856093)) ^ (b.astype(np.uint64) * np.uint64(19349663)) ^ np.uint64(salt * 83492791 + 1)
    x &= np.uint64(0xFFFFFFFF)
    x = (x * np.uint64(2654435761)) & np.uint64(0xFFFFFFFF)
    x ^= x >> np.uint64(15)
    x = (x * np.uint64(2246822519)) & np.uint64(0xFFFFFFFF)
    x ^= x >> np.uint64(13)
    return (x & np.uint64(0xFFFFFF)).astype(np.float64) / float(0x1000000)


def periodic_noise(w, h, seed, sigma=1.1):
    r = np.random.RandomState(seed)
    base = r.rand(h, w)
    pad = 6
    big = np.pad(base, pad, mode="wrap")
    sm = ndi.gaussian_filter(big, sigma)[pad:pad + h, pad:pad + w]
    return (sm - sm.min()) / (sm.max() - sm.min() + 1e-9)


def grass_period(seed, shift=0):
    """One (48 x 24) periodic grass texture: 5 greens, 2 px blade ticks, flower pixels, pebbles (palette indices -> rgb)."""
    n = periodic_noise(PX, PY, seed)
    idx = np.clip((n * 5).astype(int), 0, 4)
    t = np.zeros((PY, PX, 3), np.uint8)
    r = np.random.RandomState(seed + 100)
    out_idx = np.clip(idx + shift, 0, 4)
    for i in range(5):
        t[out_idx == i] = GRASS[i]
    special = np.zeros((PY, PX), bool)
    for _ in range(int(PX * PY / 10)):
        x, y = r.randint(0, PX), r.randint(0, PY)
        c = GRASS[int(np.clip(r.choice([0, 3, 4, 1]) + shift, 0, 4))]
        t[y % PY, x % PX] = c
        t[(y - 1) % PY, x % PX] = c
    for _ in range(2):
        y, x = r.randint(0, PY), r.randint(0, PX)
        t[y, x] = FLOWER[r.randint(0, 3)]
        special[y, x] = True
    for _ in range(1):
        x, y = r.randint(0, PX), r.randint(0, PY)
        t[y, x] = PEBBLE[r.randint(0, 3)]
        t[y, (x + 1) % PX] = PEBBLE[1]
        special[y, x] = special[y, (x + 1) % PX] = True
    return t


def tile_from_period(t):
    yy, xx = np.mgrid[0:FH, 0:FW]
    return t[yy % PY, xx % PX]


def finish(rgb, mask):
    a = np.zeros((FH, FW, 4), np.uint8)
    a[..., :3] = rgb
    a[mask, 3] = 255
    a[~mask, :3] = 0
    return a


def ground_tile(kind, v):
    mask = diamond_mask(FW, FH, FW / 2, FH / 2)
    yy, xx = np.mgrid[0:FH, 0:FW]
    shift = 0
    g = tile_from_period(grass_period(11 + v * 7, shift))
    if kind == "grass":
        return finish(g, mask)
    if kind == "lot":
        rgb = g.copy()
        # a faint worn patch + a few bare pixels: an empty lot is still moss grass, never a tan board
        for k in range(3):
            cx, cy = 48 + int((hsh(v, k, 1) - 0.5) * 30), 25 + int((hsh(v, k, 2) - 0.5) * 12)
            for _ in range(10):
                dx, dy = int((hsh(v, k, _ , 3) - 0.5) * 12), int((hsh(v, k, _, 4) - 0.5) * 5)
                rgb[cy + dy, cx + dx] = DIRT[1] if hsh(v, k, _, 5) < 0.6 else DIRT[0]
        return finish(rgb, mask)
    if kind == "sand":
        n = periodic_noise(PX, PY, 31 + v, 0.9)
        t = np.zeros((PY, PX, 3), np.uint8)
        idx = np.clip((n * 3).astype(int), 0, 2)
        for i, c in enumerate([SAND[1], SAND[0], SAND[2]]):
            t[idx == i] = c
        r = np.random.RandomState(40 + v)
        for _ in range(5):
            x, y = r.randint(0, PX), r.randint(0, PY)
            t[y, x] = PEBBLE[r.randint(0, 3)]
            t[y, (x + 1) % PX] = PEBBLE[1]
        for _ in range(4):
            x, y = r.randint(0, PX), r.randint(0, PY)
            for k in range(3):
                t[y, (x + k) % PX] = SAND[3]
        return finish(tile_from_period(t), mask)
    if kind == "road":
        n = periodic_noise(PX, PY, 51 + v, 0.8)
        t = np.zeros((PY, PX, 3), np.uint8)
        idx = np.clip((n * 3).astype(int), 0, 2)
        for i, c in enumerate([ROAD[1], ROAD[0], ROAD[2]]):
            t[idx == i] = c
        r = np.random.RandomState(60 + v)
        for _ in range(9):
            x, y = r.randint(0, PX), r.randint(0, PY)
            t[y, x] = ROAD[3] if r.rand() < .5 else PEBBLE[r.randint(0, 3)]
        return finish(tile_from_period(t), mask)
    if kind == "plot":
        # tilled soil, flush with the ground: furrows along one iso axis, dithered grass blending in at the border (no raised edge, no outline)
        n = periodic_noise(PX, PY, 71 + v, 0.8)
        t = np.zeros((PY, PX, 3), np.uint8)
        idx = np.clip((n * 3).astype(int), 0, 2)
        for i, c in enumerate([SOIL[1], SOIL[2], SOIL[0]]):
            t[idx == i] = c
        soil = tile_from_period(t)
        furrow = ((2 * yy - xx) % 12) == 0
        furrow2 = ((2 * yy - xx) % 12) == 1
        soil[furrow] = SOIL[3]
        soil[furrow2] = SOIL[0]
        # inner distance to the diamond edge
        d_in = ndi.distance_transform_edt(mask)
        blend = (d_in < 5) & (BAYER[yy % 4, xx % 4] < np.clip((5 - d_in) / 5.0, 0, 1) * 0.9)
        # the border dither must be seamless with the neighbours: it uses the neighbour's grass, which is full-tile grass (fine)
        rgb = np.where(blend[..., None], g, soil)
        return finish(rgb, mask)
    raise ValueError(kind)


# ---------------------------------------------------------------------------------------------- island shore autotiles
M = 10                    # water margin around the cell (shallows)
HF = 8                    # height of the stone side face
SW, SH = LOT_W + 2 * M, LOT_H + 2 * M + HF           # shore frame (116 x 76)
SANCHOR = (SW // 2, M + LOT_H // 2)                  # cell centre inside the frame
RIM, STRIP = 5, 5


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r + r * 0.6


def cell_of(xr, yr):
    """grid cell (di, dj) of a pixel offset from a cell centre: x = (i - j) 48, y = (i + j) 24."""
    a = (yr / STEP_Y + xr / STEP_X) / 2
    b = (yr / STEP_Y - xr / STEP_X) / 2
    return np.round(a).astype(int), np.round(b).astype(int)


def shore_frame(flags):
    """flags[(di, dj)] for the 3x3 neighbourhood (centre always land) -> RGBA shore overlay, or None when nothing to draw.
    All hashing / mortar phases use owner-cell-relative or lattice-aligned coordinates, so neighbouring frames agree."""
    yy, xx = np.mgrid[0:SH, 0:SW]
    xr = xx + 0.5 - SANCHOR[0]
    yr = yy + 0.5 - SANCHOR[1]
    ci, cj = cell_of(xr, yr)
    land = np.zeros((SH, SW), bool)
    for (di, dj), f in flags.items():
        if f:
            land |= (ci == di) & (cj == dj)
    # organic coast: round convex tips (opening) and concave corners (closing)
    pad = 16
    L = np.pad(land, pad)
    L = ndi.binary_opening(L, structure=disk(11))
    L = ndi.binary_closing(L, structure=disk(11))
    land_s = L[pad:-pad, pad:-pad]
    own = (ci == 0) & (cj == 0)
    near = (np.abs(ci) <= 1) & (np.abs(cj) <= 1)
    # owner-relative pixel offsets (consistent between frames) and integer hash keys
    ox = np.floor(xr - (ci - cj) * STEP_X).astype(np.int64)
    oy = np.floor(yr - (ci + cj) * STEP_Y).astype(np.int64)
    out = np.zeros((SH, SW, 4), np.uint8)
    # --- stone side face under land, column-wise
    below = np.zeros(land_s.shape, np.int32)
    run = np.full(SW, 99, np.int32)
    for y in range(SH):
        run = np.where(land_s[y], 0, run + 1)
        below[y] = run
    face = (~land_s) & (~land) & (below >= 1) & (below <= HF)
    d_in = ndi.distance_transform_edt(land_s)
    solid = land_s | face
    d_out = ndi.distance_transform_edt(~solid)
    ring1 = (~solid) & (~land) & (d_out <= 1.8)
    ring2 = (~solid) & (~land) & (d_out > 1.8) & (d_out <= 6.5) & (BAYER[oy % 4, ox % 4] < np.clip((6.5 - d_out) / 4.7, 0, 1) * 0.85)
    sh = (ring1 | ring2) & near
    face &= near
    out[ring2 & sh] = (*SHALLOW2, 255)
    out[ring1 & sh] = (*SHALLOW1, 255)
    abs_x = np.floor(xr).astype(np.int64)             # lattice aligned: cell centres are multiples of 48 in x
    for y, x in zip(*np.nonzero(face)):
        t = below[y, x]
        course = (t - 1) // 4
        phase = abs_x[y, x] + (4 if course else 0)
        c = STONE_SIDE[int(hsh(phase // 8, course, 7) * 3)]
        if phase % 8 == 0:
            c = (66, 64, 60)
        if t == 1:
            c = (150, 148, 138) if (abs_x[y, x] // 3) % 3 else STONE_SIDE[0]
        ny = min(y + 1, SH - 1)
        if t >= HF or not face[ny, x]:
            c = (48, 46, 44)
        out[y, x] = (*c, 255)
    # --- land pixels owned by this cell: stone rim, sand / pebble strip, dithered lip.
    # Closing may also fill pixels of a water neighbour; those belong to the owner cell of the pixel and are painted by every frame that sees them.
    paint = (land_s & (own | (~land & near)))
    rim = paint & (d_in <= RIM)
    strip = paint & (d_in > RIM) & (d_in <= RIM + STRIP) & own
    lip = paint & (d_in > RIM + STRIP) & (d_in <= RIM + STRIP + 2) & (BAYER[oy % 4, ox % 4] < 0.4) & own
    for y, x in zip(*np.nonzero(rim)):
        dd = d_in[y, x]
        bi = int(abs_x[y, x] // 8)
        c = STONE_TOP[int(hsh(bi, 3) * 4)]
        if dd <= 1.0:
            c = (52, 50, 46)
        elif dd > RIM - 1.0:
            c = (186, 182, 168)
        elif abs_x[y, x] % 8 == 0:
            c = (92, 90, 84)
        out[y, x] = (*c, 255)
    for y, x in zip(*np.nonzero(strip)):
        r = hsh(ox[y, x], oy[y, x], 91)
        c = SAND[0] if r < 0.55 else SAND[2] if r < 0.8 else SAND[1]
        if r > 0.965:
            c = PEBBLE[int(hsh(ox[y, x], oy[y, x], 92) * 3)]
        out[y, x] = (*c, 255)
    for y, x in zip(*np.nonzero(lip)):
        out[y, x] = (*SAND[1], 255)
    cut = own & ~land_s
    out[cut] = (*SHALLOW2, 255)
    if not out[..., 3].any():
        return None
    return out


def all_shore_frames():
    """256 raw 3x3 masks -> {name: frame}, identical frames shared. Returns (frames, mask -> name)."""
    cells = [(di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1) if (di, dj) != (0, 0)]
    frames, names, seen = {}, {}, {}
    for m in range(255):                                   # 255 = every neighbour is land: no shore
        flags = {(0, 0): True}
        for k, c in enumerate(cells):
            flags[c] = bool(m >> k & 1)
        fr = shore_frame(flags)
        if fr is None:
            continue
        key = fr.tobytes()
        if key not in seen:
            seen[key] = f"shore/{len(seen)}"
            frames[seen[key]] = fr
        names[m] = seen[key]
    return frames, names, cells


# ---------------------------------------------------------------------------------------------- sea
SEA_T = 32


def sea_tiles(rough=False):
    """4 stepped frames of a flat teal pattern (calm: sparse short dashes; rough: more and longer, whitecap glints)."""
    s = SEA_T
    r0 = np.random.RandomState(5)
    dark = [(r0.randint(0, s), r0.randint(0, s), r0.randint(3, 6)) for _ in range(14)]
    out = []
    for fi in range(4):
        t = np.zeros((s, s, 3), np.uint8)
        t[:] = SEA[0]
        for x, y, w in dark:
            for i in range(w):
                t[y % s, (x + i) % s] = SEA[1]
        r = np.random.RandomState(100 + fi + (50 if rough else 0))
        for _ in range(16 if rough else 8):
            x, y, w = r.randint(0, s), r.randint(0, s), r.randint(3, 7) if rough else r.randint(2, 4)
            for i in range(w):
                t[y % s, (x + i) % s] = SEA[2]
        for _ in range(5 if rough else 2):
            t[r.randint(0, s), r.randint(0, s)] = SEA[3]
        a = np.dstack([t, np.full((s, s), 255, np.uint8)])
        out.append(a)
    return out


def water_glints():
    """High: a sparse transparent overlay of light dashes (stepped in game), tiles seamlessly."""
    s = 64
    r = np.random.RandomState(9)
    a = np.zeros((s, s, 4), np.uint8)
    for _ in range(14):
        x, y, w = r.randint(0, s), r.randint(0, s), r.randint(3, 6)
        for i in range(w):
            a[y % s, (x + i) % s] = (*SEA[2], 255)
        a[(y + 1) % s, (x + 1) % s] = (*SEA[1], 255)
    for _ in range(4):
        a[r.randint(0, s), r.randint(0, s)] = (*SEA[3], 255)
    return a


def cloud_shadows():
    out = []
    for ci, (bw_, bh_, blobs) in enumerate([(104, 44, [(30, 22, 26, 14), (56, 20, 30, 16), (78, 24, 20, 11), (48, 28, 24, 10)]), (80, 36, [(26, 18, 22, 12), (46, 20, 24, 13), (60, 22, 14, 9)])]):
        w, h = bw_, bh_
        t = np.zeros((h, w, 4), np.uint8)
        yy2, xx2 = np.mgrid[0:h, 0:w]
        dmin = np.full((h, w), 9.0)
        for (bx, by, rx, ry) in blobs:
            dd = np.sqrt(((xx2 - bx) / rx) ** 2 + ((yy2 - by) / ry) ** 2)
            dmin = np.minimum(dmin, dd)
        solid = dmin < 0.78
        edge = (dmin >= 0.78) & (dmin < 1.0) & ((xx2 + yy2) % 2 == 0)
        t[solid | edge] = (20, 40, 50, 255)
        out.append(t)
    return out
