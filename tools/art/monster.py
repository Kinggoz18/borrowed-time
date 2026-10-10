"""The Long Dusk (docs/LORE.md, FINAL_PLAN_BT.md "Long Dusk spectacle"): a hooded shadow of everything owed, with two long arms
and amber eyes, that rises out of the sea behind the island on day 6. Three sizes (tied to the raid's strength) x four frames
(arms sway, hem ripples, eyes pulse). Hard pixels, dithered where the shadow melts into the water."""
import numpy as np
from PIL import Image, ImageDraw
from pixlib import BAYER, hsh

BODY = (36, 31, 52)
SHADE = (24, 21, 38)
DEEP = (14, 12, 24)
RIM = (74, 66, 102)
MIST = (52, 46, 72)
EYE = [(255, 214, 140), (240, 178, 100), (255, 232, 176), (214, 150, 84)]
SIZES = [0.72, 1.0, 1.32]                 # small / medium / large
BASE_W, BASE_H = 190, 160


def mask_poly(w, h, pts):
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon([(round(x), round(y)) for x, y in pts], fill=255)
    return np.array(im) > 0


def thick_curve(w, h, p0, p1, p2, w0, w1, n=40):
    """quadratic bezier drawn as a tapering stroke of discs"""
    m = np.zeros((h, w), bool)
    yy, xx = np.mgrid[0:h, 0:w]
    for k in range(n + 1):
        t = k / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        r = w0 + (w1 - w0) * t
        m |= (xx - x) ** 2 + (yy - y) ** 2 <= r * r
    return m


def frame(size_i, f):
    s = SIZES[size_i]
    W, H = round(BASE_W * s), round(BASE_H * s)
    cx = W / 2
    ph = f / 4 * 2 * np.pi
    sway = np.sin(ph)
    body = np.zeros((H, W), bool)
    # hood and cloak: narrow peak, shoulders, long skirt with a rippling hem
    rows = np.arange(H)
    hood_top = 0.06 * H
    for y in rows:
        t = y / H
        if y < hood_top:
            continue
        if t < 0.30:
            hw = (6 + 30 * ((t - 0.06) / 0.24) ** 0.7) * s
        elif t < 0.46:
            hw = (36 + 10 * (t - 0.30) / 0.16) * s
        else:
            hw = (46 + 22 * ((t - 0.46) / 0.54) ** 1.2) * s
        ripple = np.sin(y * 0.55 + ph) * (0.5 + 3.0 * max(0, t - 0.6)) * s
        x0, x1 = int(round(cx - hw + ripple)), int(round(cx + hw + ripple))
        body[y, max(0, x0):min(W, x1)] = True
    # arms: two long curved limbs from the shoulders, swaying (the prototype's reaching arms)
    for sg in (-1, 1):
        lift = 0.5 + 0.5 * np.sin(ph + (0 if sg < 0 else np.pi * 0.6))
        sh = (cx + sg * 26 * s, 0.38 * H)
        mid = (cx + sg * (70 + 8 * lift) * s, (0.40 - 0.08 * lift) * H)
        tip = (cx + sg * (60 + 16 * lift) * s, (0.05 + 0.13 * (1 - lift)) * H + 4 * s)
        arm = thick_curve(W, H, sh, mid, tip, 9.5 * s, 3.6 * s)
        body |= arm
        # claws: three short fingers at the tip
        yy, xx = np.mgrid[0:H, 0:W]
        for k, ang in enumerate((-0.9, 0.0, 0.9)):
            a = ang + (-np.pi / 2) + sg * 0.35
            fx, fy = tip[0] + np.cos(a) * 15 * s, tip[1] + np.sin(a) * 15 * s
            claw = thick_curve(W, H, tip, ((tip[0] + fx) / 2, (tip[1] + fy) / 2), (fx, fy), 3.0 * s, 1.0 * s, 10)
            body |= claw
    a = np.zeros((H, W, 4), np.uint8)
    # shade: base on the left of the figure, shade on the right, deep lining inside the hood
    col = np.zeros((H, W, 3), np.uint8)
    col[:] = BODY
    split = (xx - cx) / s + (BAYER[yy % 4, xx % 4] - 0.5) * 14
    col[split > 8] = SHADE
    # mist wisps across the cloak (dithered stripes that drift with the frame)
    wisp = (((yy + f * 2) // 3) % 7 == 0) & ((xx * 3 + yy) % 4 < 2)
    col[wisp & body & (yy > 0.4 * H)] = MIST
    # hood opening
    hy0, hy1 = int(0.14 * H), int(0.34 * H)
    hood = np.zeros((H, W), bool)
    for y in range(hy0, hy1):
        t = (y - hy0) / max(1, hy1 - hy0)
        hw = (5 + 15 * np.sin(np.pi * min(1, t * 0.95 + 0.05))) * s
        hood[y, int(cx - hw):int(cx + hw)] = True
    col[hood] = DEEP
    # rim light on the upper-left edge
    left_edge = body & ~np.roll(body, 1, 1)
    col[left_edge & (yy < 0.7 * H)] = RIM
    top_edge = body & ~np.roll(body, 1, 0)
    col[top_edge] = RIM
    out = body.copy()
    # dither the lower fifth into the water
    fade_y0 = int(0.78 * H)
    keep = np.ones((H, W), bool)
    for y in range(fade_y0, H):
        u = (y - fade_y0) / (H - fade_y0)
        keep[y] = BAYER[y % 4, np.arange(W) % 4] >= u * 0.95
    out &= keep
    a[out, :3] = col[out]
    a[out, 3] = 255
    # dark outline (inside the silhouette's edge, so the sprite does not grow)
    edge = out & ~(np.roll(out, 1, 0) & np.roll(out, -1, 0) & np.roll(out, 1, 1) & np.roll(out, -1, 1))
    edge &= (yy < fade_y0)
    a[edge & ~(col == RIM).all(-1) & ~hood, :3] = SHADE
    # eyes: two amber slits with a bright core, pulsing across the frames
    ey = int(0.235 * H)
    for sg in (-1, 1):
        ex = int(round(cx + sg * 8.5 * s))
        for dx in range(-2, 3):
            a[ey, ex + dx] = (*EYE[(f + 3) % 4], 255) if abs(dx) < 2 else (*EYE[(f + 1) % 4], 255)
        a[ey - 1, ex - 1:ex + 2] = (*EYE[f], 255)
        a[ey + 1, ex] = (*EYE[(f + 3) % 4], 255)
    return a, (W // 2, H - 1)


def frames():
    out = {}
    for si in range(len(SIZES)):
        for f in range(4):
            out[f"fx/monster/{si}/{f}"] = frame(si, f)
    return out


def arrow():
    a = np.zeros((5, 13, 4), np.uint8)
    a[2, 1:11] = (122, 82, 48, 255)
    a[2, 11:13] = (210, 206, 190, 255)
    a[1, 11] = a[3, 11] = (150, 148, 138, 255)
    a[1, 0:2] = a[3, 0:2] = (220, 214, 190, 255)
    a[2, 0] = (220, 214, 190, 255)
    return a, (12, 2)
