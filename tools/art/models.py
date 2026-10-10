"""Colony-era models (looks 1-2) and shared set pieces, as pixel sprites at the medium scale (lot diamond 96x48).
The cottage and the watchtower are the approved generated art (keyed + pixelized); everything else is built with isorender."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from isorender import *
from pixlib import box_down, hard, trim, outline, INK, LOT_W, LOT_H, hsh

HERE = os.path.dirname(os.path.abspath(__file__))
BW, BH, BAX, BAY = 120, 136, 60, 130          # building frame and the lot front vertex inside it
BASE = 0.11                                    # pixelized source scale: cottage ends ~88 px wide


def load_src(name, scale=BASE):
    scale = {"tower": 0.142}.get(name, scale)
    im = Image.open(f"{HERE}/src/{name}.png").convert("RGBA")
    a = hard(box_down(im, scale / 0.4))
    return a


def paste(dst, src, x, y):
    """alpha-composite src (hard alpha) onto dst at integer x, y (may clip)."""
    h, w = src.shape[:2]
    for yy in range(h):
        for xx in range(w):
            if src[yy, xx, 3] and 0 <= y + yy < dst.shape[0] and 0 <= x + xx < dst.shape[1]:
                dst[y + yy, x + xx] = src[yy, xx]


def frame():
    return np.zeros((BH, BW, 4), np.uint8)


def sprite():
    return Sprite(BW, BH, BAX, BAY)


# ---------------------------------------------------------------------------------------------- generated art
def cottage_l1():
    s = load_src("cottage")
    s, (ox, oy) = trim(s)
    f = frame()
    x = BAX - s.shape[1] // 2 + 2
    y = BAY - s.shape[0] - 4
    paste(f, s, x, y)
    return f, {"chimney": [x + s.shape[1] * 0.78, y + 2]}


def tower_l1():
    s = load_src("tower")
    s, _ = trim(s)
    f = frame()
    x = BAX - s.shape[1] // 2
    y = BAY - s.shape[0] - 14
    paste(f, s, x, y)
    # pole top = topmost opaque row
    ys, xs = np.nonzero(f[..., 3])
    top = ys.min()
    return f, {"pole": [float(xs[ys == top].mean()), float(top)]}


def stretch_rows(a, y0, y1, extra):
    """Repeat the rows [y0, y1) so the sprite grows `extra` px taller (legs are repetitive timber, so this reads as a taller structure)."""
    band = a[y0:y1]
    n = int(np.ceil(extra / max(1, y1 - y0)))
    ins = np.concatenate([band] * n, 0)[:extra]
    return np.concatenate([a[:y0], ins, a[y0:]], 0)


def tower_l2():
    """Crow's-nest watchtower: the log tower, +14 px of legs, a canvas roof over the nest, mast and rag kept."""
    s = load_src("tower")
    s, _ = trim(s)
    h = s.shape[0]
    s = stretch_rows(s, int(h * 0.62), int(h * 0.62) + 8, 14)
    f = frame()
    x = BAX - s.shape[1] // 2
    y = BAY - s.shape[0] - 14
    paste(f, s, x, y)
    # canvas roof (small pyramid) over the nest, drawn as a sail: two slopes
    sp = sprite()
    ncx, ncy = x + s.shape[1] // 2, y + int(s.shape[0] * 0.30)
    for i in range(0, 15):
        w = int(round(i * 1.55))
        for dx in range(-w, w + 1):
            tone = CANVAS["light"] if dx < -w * 0.25 else CANVAS["base"] if dx < w * 0.45 else CANVAS["shade"]
            if (dx + i) % 7 == 0:
                tone = CANVAS["shade"] if tone != CANVAS["shade"] else CANVAS["dark"]
            sp._px(ncx + dx, ncy - 14 + i, tone)
        sp._px(ncx - w, ncy - 14 + i, CANVAS["dark"]); sp._px(ncx + w, ncy - 14 + i, CANVAS["dark"])
    for dx in range(-24, 25):
        sp._px(ncx + dx, ncy + 1, CANVAS["dark"])
    sp._px(ncx, ncy - 15, WOOD["dark"])
    paste(f, sp.a, 0, 0)
    ys, xs = np.nonzero(f[..., 3])
    top = ys.min()
    return f, {"pole": [float(xs[ys == top].mean()), float(top)]}


def cottage_l2():
    """Settled hut: the ferry cottage plus a fieldstone chimney stack (replaces the iron pipe) and a lantern post by the door."""
    f, info = cottage_l1()
    cx, cy = int(info["chimney"][0]), int(info["chimney"][1])
    st = sprite()
    top, bot, hw = cy - 8, cy + 20, 7
    for y in range(top, bot):
        for x in range(cx - hw, cx + hw):
            course = (y - top) // 5
            off = 3 if course % 2 else 0
            left = x < cx
            c = STONE["base"] if left else STONE["shade"]
            if (x + off) % 6 == 0 or (y - top) % 5 == 0:
                c = STONE["dark"]
            elif hsh(x // 3, course, 5) < 0.25:
                c = STONE["light"] if left else STONE["base"]
            st._px(x, y, c)
    for x in range(cx - hw - 1, cx + hw + 1):                      # cap slab
        st._px(x, top - 1, STONE["light"]); st._px(x, top, STONE["dark"])
    for y in range(top - 1, bot):
        st._px(cx - hw - 1, y, STONE["dark"]) if y < top + 1 else st._px(cx - hw - 1, y, INK)
        st._px(cx + hw, y, INK)
    # a thin dark void under the cap: where the smoke leaves
    for x in range(cx - 3, cx + 3):
        st._px(x, top - 2, TAR["base"])
    paste(f, st.a, 0, 0)
    sp = sprite()
    sp.post(0.30, 1.04, 0, 22, 3, WOOD)
    px, py = sp.P(0.30, 1.04, 22)
    sp.rect(int(px) - 2, int(py) - 6, 5, 6, BRASS["base"])
    sp.rect(int(px) - 1, int(py) - 5, 3, 4, (250, 220, 130))
    paste(f, sp.a, 0, 0)
    return f, {"chimney": [cx, top - 3]}


# ---------------------------------------------------------------------------------------------- procedural models
def hourglass(sp, x, y, h=12, w=7):
    """pixel hourglass (brass caps, glass, a thread of sand), bottom centre (x, y)."""
    top = y - h
    for i in range(h):
        t = abs((i - h / 2) / (h / 2))
        half = int(round(1 + (w // 2 - 1) * t))
        for dx in range(-half, half + 1):
            c = GLASS["light"] if dx < 0 else GLASS["base"]
            if i > h / 2 + 1 and abs(dx) < half:
                c = (218, 190, 120)
            sp._px(x + dx, top + i, c)
        sp._px(x - half - 1 if half < w // 2 else x - half, top + i, GLASS["dark"]) if False else None
    sp.rect(x - w // 2 - 1, top - 1, w + 2, 2, BRASS["base"])
    sp.rect(x - w // 2 - 1, y, w + 2, 2, BRASS["base"])
    sp.rect(x - w // 2 - 1, top - 1, w + 2, 1, BRASS["light"])


def ship_wheel(sp, cx, cy, r=9, color=BRASS):
    sp.disc(cx, cy, r, INK)
    sp.disc(cx, cy, r - 1, color["base"])
    sp.disc(cx, cy, r - 3, INK)
    sp.disc(cx, cy, r - 4, (0, 0, 0, 0)[:3]) if False else None
    for k in range(8):
        ang = k * np.pi / 4
        sp.line((cx, cy), (cx + np.cos(ang) * (r + 2), cy + np.sin(ang) * (r + 2)), color["light"] if k % 2 else color["shade"])
    sp.disc(cx, cy, 2, color["light"])


def workshop_l1():
    """Sea-chest bench: a plank bench, a sea chest with brass bands, a vice, and a ship's wheel leaning on the end."""
    sp = sprite()
    sp.box(0.22, 0.34, 0.80, 0.62, 0, 14, "hplank", PLANK, salt=3)                       # bench body
    sp.box(0.20, 0.30, 0.84, 0.66, 14, 3, "hplank", WOOD, salt=4)                        # worktop
    sp.box(0.30, 0.36, 0.52, 0.58, 17, 10, "plank", TAR, salt=5)                         # sea chest
    for z in (19, 25):
        l = sp.P(0.30, 0.58, z); r = sp.P(0.52, 0.58, z)
        sp.line(l, r, BRASS["base"])
    sp.rect(int(sp.P(0.41, 0.58, 22)[0]) - 1, int(sp.P(0.41, 0.58, 22)[1]) - 1, 3, 3, BRASS["light"])
    sp.box(0.62, 0.40, 0.72, 0.50, 17, 5, "plank", STONE, salt=6)                        # anvil block
    sp.box(0.60, 0.42, 0.74, 0.48, 22, 2, "plank", TAR, salt=6)
    x, y = sp.P(0.86, 0.5, 20)
    ship_wheel(sp, int(x), int(y) - 6, 9)
    a = sp.finish()
    sp.shadow(0.12, 0.2, 0.95, 0.9)
    return sp.a, {}


def workshop_l2():
    """Plank shed with a ship's wheel: four posts, tarred back walls, a canvas gable roof, the wheel on the front."""
    sp = sprite()
    sp.box(0.18, 0.26, 0.86, 0.38, 0, 26, "plank", TAR, salt=8)                          # back wall
    sp.box(0.18, 0.26, 0.30, 0.80, 0, 26, "plank", TAR, salt=9)                          # left wall
    sp.box(0.30, 0.50, 0.72, 0.74, 0, 11, "hplank", PLANK, salt=10)                      # long bench
    sp.box(0.34, 0.52, 0.50, 0.70, 11, 8, "plank", WOOD, salt=11)
    for a, b in ((0.18, 0.84), (0.86, 0.84), (0.86, 0.28)):
        sp.post(a, b, 0, 30, 4, WOOD)
    sp.prism(0.12, 0.20, 0.92, 0.90, 30, 15, "a", "cloth", CANVAS, salt=12)
    x, y = sp.P(0.90, 0.56, 16)
    ship_wheel(sp, int(x) + 3, int(y) - 4, 10)
    sp.finish()
    sp.shadow(0.1, 0.15, 0.98, 0.95)
    return sp.a, {}


def bank_l1():
    """Salvage crate with a hourglass on a brass-banded lid."""
    sp = sprite()
    sp.box(0.26, 0.28, 0.74, 0.74, 0, 16, "plank", PLANK, salt=14)
    for z in (4, 12):
        sp.line(sp.P(0.26, 0.74, z), sp.P(0.74, 0.74, z), BRASS["shade"])
        sp.line(sp.P(0.74, 0.74, z), sp.P(0.74, 0.28, z), BRASS["shade"])
    sp.box(0.30, 0.32, 0.70, 0.70, 16, 3, "hplank", WOOD, salt=15)
    x, y = sp.P(0.5, 0.52, 19)
    hourglass(sp, int(x), int(y), 15, 9)
    sp.finish()
    sp.shadow(0.12, 0.15, 0.92, 0.95)
    return sp.a, {}


def bank_l2():
    """Canvas stall: four posts, a striped canvas awning, a counter with the hourglass."""
    sp = sprite()
    sp.box(0.24, 0.30, 0.76, 0.72, 0, 13, "plank", PLANK, salt=16)
    sp.box(0.20, 0.26, 0.80, 0.76, 13, 3, "hplank", WOOD, salt=17)
    for a, b in ((0.18, 0.84), (0.84, 0.84), (0.84, 0.18), (0.18, 0.18)):
        sp.post(a, b, 0, 40, 3, WOOD)
    P = sp.P
    z0, z1 = 36, 46
    awn = [P(0.12, 0.90, z0), P(0.90, 0.90, z0), P(0.90, 0.12, z1), P(0.12, 0.12, z1)]
    def awn_color(x, y):
        k = int((x + y * 0.0) // 6) % 2
        return CANVAS["base"] if k else STRIPE_RED["base"] if False else CANVAS["light"]
    sp.fill(awn, lambda x, y: CANVAS["light"] if (int(x) // 6) % 2 else CANVAS["base"], edge=CANVAS["dark"])
    for i in range(0, 14):
        sp._px(int(P(0.12, 0.90, z0)[0]) + i * 6, int(P(0.12, 0.90, z0)[1]) + 1 + (i % 2), CANVAS["shade"])
    x, y = P(0.5, 0.52, 16)
    hourglass(sp, int(x), int(y), 14, 8)
    sp.finish()
    sp.shadow(0.1, 0.1, 0.98, 0.98)
    return sp.a, {}


def sprout(frame_i, ph, size=1):
    """a pixel sprout: 4x5 stem + 2 leaves; sway frame 0..2 shifts the tip. returns small RGBA."""
    g1, g2, g3 = (132, 186, 64), (92, 150, 48), (56, 104, 36)
    a = np.zeros((7, 7, 4), np.uint8)
    sway = [-1, 0, 1][(frame_i + ph) % 3]
    px = lambda x, y, c: a.__setitem__((y, x), (*c, 255))
    px(3, 6, g3); px(3, 5, g2); px(3, 4, g2)
    px(3 + (sway if sway else 0) // 1, 3, g1)
    px(2, 4, g1); px(4, 4, g2)
    px(2 + sway, 3, g2); px(4 + sway, 3, g1)
    px(3 + sway, 2, g1)
    return a


def field_frames(look):
    """Field decal frames (3 sway steps): sprouts in a 5x4 staggered grid on the flush soil; look 2 adds a rope fence of driftwood posts.
    Frame is the lot diamond (96x50) with the anchor at its front vertex."""
    out = []
    W, H = 100, 70
    for fi in range(3):
        sp = Sprite(W, H, 50, H - 8)
        # sprouts on a diamond-aligned grid in lot coords, each with its own phase so the wind rolls across the field
        for ia in range(5):
            for ib in range(5):
                a = 0.2 + ia * 0.15
                b = 0.2 + ib * 0.15
                x, y = sp.P(a, b, 0)
                s = sprout(fi, (ia + ib * 2) % 3)
                paste(sp.a, s, int(x) - 3, int(y) - 6)
        if look >= 1:
            pts = [(0.06, 0.06), (0.94, 0.06), (0.94, 0.94), (0.06, 0.94)]
            for a, b in [(0.06, 0.06), (0.5, 0.06), (0.94, 0.06), (0.94, 0.5), (0.94, 0.94), (0.5, 0.94), (0.06, 0.94), (0.06, 0.5)]:
                sp.post(a, b, 0, 11 if (a, b) in pts else 8, 3, WOOD)
            for (a0, b0), (a1, b1) in zip(pts, pts[1:] + pts[:1]):
                sp.line(sp.P(a0, b0, 7), sp.P(a1, b1, 7), ROPE["base"])
                sp.line(sp.P(a0, b0, 4), sp.P(a1, b1, 4), ROPE["shade"])
        out.append(sp.a)
    return out, (50, H - 8)


# ---------------------------------------------------------------------------------------------- set pieces
def tent():
    """Hesper's striped cone with the hourglass plaque, door flap and two guy ropes. Never re-skinned."""
    W, H = 100, 110
    sp = Sprite(W, H, 50, 100)
    cx, base_y, rx, top = 50, 88, 30, 14
    for y in range(top, base_y + 16):
        w = (y - top) / (base_y - top)
        half = rx * w
        for x in range(int(cx - half) - 1, int(cx + half) + 2):
            u = (x + 0.5 - cx) / max(half, 0.5)
            if y <= base_y:
                inside = abs(u) <= 1
            else:
                inside = abs(u) <= 1 and (y - base_y) <= np.sqrt(max(0, 1 - u * u)) * (rx * 0.5)
            if not inside:
                continue
            k = int((u + 1) * 3.0)
            red = k % 2 == 0
            ramp = STRIPE_RED if red else CANVAS
            c = ramp["light"] if u < -0.35 else ramp["base"] if u < 0.4 else ramp["shade"]
            if abs(u) > 0.93:
                c = ramp["dark"]
            if y > base_y - 2 and y <= base_y + 1:
                c = ramp["dark"]
            sp._px(x, y, c)
    # door flap
    for y in range(base_y - 22, base_y + 6):
        h = (y - (base_y - 22)) / 28
        for x in range(cx - 1 - int(7 * h), cx + 2 + int(7 * h)):
            sp._px(x, y, TAR["base"] if x > cx - 3 else TAR["shade"])
    # plaque + hourglass
    sp.rect(cx - 8, 38, 16, 18, CANVAS["base"])
    for x in range(cx - 8, cx + 8):
        sp._px(x, 38, WOOD["dark"]); sp._px(x, 55, WOOD["dark"])
    for y in range(38, 56):
        sp._px(cx - 8, y, WOOD["dark"]); sp._px(cx + 7, y, WOOD["dark"])
    hourglass(sp, cx, 53, 11, 7)
    # pole + pennant
    for y in range(top - 8, top + 1):
        sp._px(cx, y, WOOD["dark"])
    # guy ropes
    sp.line((cx - 24, 70), (cx - 40, 96), ROPE["base"])
    sp.line((cx + 24, 70), (cx + 40, 96), ROPE["base"])
    sp.rect(cx - 41, 96, 3, 3, WOOD["shade"]); sp.rect(cx + 39, 96, 3, 3, WOOD["shade"])
    a = sp.finish()
    sp.shadow(0.1, 0.1, 0.98, 0.98)
    return sp.a, (50, 100), {"pole": [cx, top - 8]}


def gnomon():
    """The gnomon: older than every era. A stone needle on a low dial slab with an engraved ring."""
    sp = sprite()
    sp.box(0.14, 0.14, 0.86, 0.86, 0, 5, "stone", STONE, salt=21)
    cx, cy = sp.P(0.5, 0.5, 5)
    for k in range(60):
        ang = k / 60 * 2 * np.pi
        x = int(cx + np.cos(ang) * 30); y = int(cy + np.sin(ang) * 15)
        sp._px(x, y, STONE["dark"])
    for k in range(12):
        ang = k / 12 * 2 * np.pi
        sp._px(int(cx + np.cos(ang) * 26), int(cy + np.sin(ang) * 13), STONE["shade"])
    for i in range(54):
        w = max(1.0, 3.5 - i * 0.05)
        for dx in range(-int(w), int(w) + 1):
            c = STONE["light"] if dx < 0 else STONE["shade"] if dx > 0 else STONE["base"]
            sp._px(int(cx) + dx, int(cy) - 2 - i, c)
    sp.finish()
    return sp.a, {}


# ---------------------------------------------------------------------------------------------- ring (palisade) and gate, 4 stages
RW, RH, RAX, RAY = 96, 96, 48, 76


def ring_piece(stage, piece):
    sp = Sprite(RW, RH, RAX, RAY)
    h = [14, 16, 22, 26][stage]
    wood = [WOOD, PLANK, WOOD, WOOD][stage]
    along = piece == "segA"
    if piece == "post":
        sp.post(0.5, 0.5, 0, h + 8, 5, WOOD)
        x, y = sp.P(0.5, 0.5, h + 8)
        sp._px(int(x), int(y) - 1, WOOD["light"]); sp._px(int(x) - 1, int(y), WOOD["light"]); sp._px(int(x) + 1, int(y), WOOD["base"])
        sp.finish()
        sp.shadow(0.3, 0.3, 0.7, 0.7)
        return sp.a
    def at(u, z):
        return sp.P(u, 0.5, z) if along else sp.P(0.5, u, z)
    if stage == 0:
        for u in (0.1, 0.3, 0.5, 0.7, 0.9):
            x, y = at(u, 0)
            for dy in range(h):
                for dx in range(-1, 2):
                    sp._px(int(x) + dx, int(y) - dy, WOOD["light"] if dx < 0 else WOOD["shade"] if dx > 0 else WOOD["base"])
            sp._px(int(x), int(y) - h, WOOD["light"]); sp._px(int(x), int(y) - h - 1, WOOD["base"])
        sp.line(at(0.0, 5), at(1.0, 5), ROPE["base"])
    else:
        t = 0.10
        a0, a1 = (0.0, 1.0)
        mat = "hplank" if stage == 1 else "plank"
        if along:
            sp.box(0.0, 0.5 - t, 1.0, 0.5 + t, 0, h, mat, wood, salt=30 + stage)
        else:
            sp.box(0.5 - t, 0.0, 0.5 + t, 1.0, 0, h, mat, wood, salt=30 + stage)
        if stage >= 2:   # pointed log tops
            for u in np.arange(0.06, 1.0, 0.115):
                x, y = at(float(u), h)
                for k in range(3):
                    sp._px(int(x) - 1 + k, int(y) - 1, WOOD["light"])
                sp._px(int(x), int(y) - 2, WOOD["light"])
        if stage == 3:
            sp.line(at(0, h - 5), at(1, h - 5), WOOD["dark"], 2)
            sp.line(at(0, h - 7), at(1, h - 7), PLANK["light"], 1)
    sp.finish()
    sp.shadow(0.0, 0.3, 1.0, 0.7)
    return sp.a


def gate_piece(stage, along, shut):
    sp = Sprite(RW, RH, RAX, RAY)
    h = [20, 22, 28, 32][stage]
    at = (lambda u, z: sp.P(u, 0.5, z)) if along else (lambda u, z: sp.P(0.5, u, z))
    if shut:
        pts = [at(0.2, 0), at(0.8, 0), at(0.8, h - 4), at(0.2, h - 4)]
        sp.face(pts, "plank", PLANK, "right" if not along else "left", salt=40, uv=lambda x, y: (x, y))
        for z in (6, h - 10):
            sp.line(at(0.2, z), at(0.8, z), BRASS["shade"])
    for u in (0.1, 0.9):
        a, b = (u, 0.5) if along else (0.5, u)
        sp.post(a, b, 0, h, 6, WOOD)
    # lintel
    for z in (h, h + 1, h + 2, h + 3):
        sp.line(at(0.04, z), at(0.96, z), WOOD["base"] if z < h + 3 else WOOD["light"])
    sp.finish()
    sp.shadow(0.0, 0.3, 1.0, 0.7)
    return sp.a
