"""Field decals (flush on the lot, 3 sway frames) for the village, town and city looks."""
import numpy as np
from b2 import *
from vil import S, hg

SOIL = {"light": (150, 108, 70), "base": (120, 84, 54), "shade": (92, 62, 40), "dark": (58, 38, 24)}
WHEAT = [(238, 196, 88), (214, 164, 62), (176, 128, 46)]
LEAF = [(150, 200, 78), (104, 160, 56), (66, 116, 44)]


def soil(sp, a0, b0, a1, b1, salt=1):
    P = sp.P
    sp.fill([P(a0, b1), P(a1, b1), P(a1, b0), P(a0, b0)], lambda x, y: SOIL["base"] if hsh(int(x) // 2, int(y), salt) > 0.2 else SOIL["shade"], edge=None)
    # furrows: lines running along a
    n = max(3, int((b1 - b0) / sp.wu(7)))
    for i in range(n + 1):
        b = b0 + (b1 - b0) * i / n
        sp.line(P(a0, b), P(a1, b), SOIL["dark"])


def stalk(sp, x, y, h, col, sway, tall=1.0):
    for k in range(int(h)):
        off = int(round(sway * (k / max(1, h)) * 1.5))
        sp._px(x + off, y - k, col[1] if k % 3 else col[0])
    sp._px(x + int(round(sway * 1.5)), y - int(h), col[0])
    sp._px(x + int(round(sway * 1.5)) + 1, y - int(h) + 1, col[2])


def fence(sp, a0, b0, a1, b1, n, h, ramp=WOOD, rail=ROPE["base"], posts=True, stone=False):
    P = sp.P
    pts = [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]
    for (pa, pb), (qa, qb) in zip(pts, pts[1:] + pts[:1]):
        if (pa, pb) == (a0, b0) and (qa, qb) == (a1, b0) or (pa, pb) == (a1, b0) and (qa, qb) == (a1, b1):
            pass
        if stone:
            sp.line(P(pa, pb, 3), P(qa, qb, 3), STONE["light"], 3); sp.line(P(pa, pb, 0), P(qa, qb, 0), STONE["shade"], 1)
        else:
            sp.line(P(pa, pb, h * 0.8), P(qa, qb, h * 0.8), rail); sp.line(P(pa, pb, h * 0.4), P(qa, qb, h * 0.4), WOOD["shade"])
    if posts and not stone:
        for (pa, pb), (qa, qb) in zip(pts, pts[1:] + pts[:1]):
            for t in np.linspace(0, 1, n, endpoint=False):
                sp.post(pa + (qa - pa) * t, pb + (qb - pb) * t, 0, h, 3, ramp)


def village_field(st, fi):
    sp = B2(1, 56, 800 + st, span=1.0)
    P = sp.P
    soil(sp, 0.06, 0.06, 0.94, 0.94, 2)
    ripe = st >= 2
    rows = 6
    for ia in range(rows):
        for ib in range(rows):
            a, b = 0.14 + ia * 0.7 / (rows - 1), 0.14 + ib * 0.7 / (rows - 1)
            x, y = P(a, b, 0)
            sway = [-1, 0, 1][(fi + ia + ib * 2) % 3]
            if not ripe:
                stalk(sp, int(x), int(y), 4 + (st == 1), LEAF, sway)
            else:
                stalk(sp, int(x), int(y), 7, WHEAT, sway)
                stalk(sp, int(x) + 2, int(y) + 1, 6, WHEAT, sway)
    if st >= 1:
        fence(sp, 0.04, 0.04, 0.96, 0.96, 4, 11 if st >= 2 else 8)
    if st >= 3:         # scarecrow: the only vertical
        x, y = P(0.5, 0.5, 0)
        x, y = int(x), int(y)
        sp.line((x, y), (x, y - 26), WOOD["base"], 2); sp.line((x - 9, y - 18), (x + 9, y - 18), WOOD["base"], 2)
        sp.rect(x - 4, y - 24, 8, 8, DAUB["base"]); sp.rect(x - 4, y - 24, 8, 1, DAUB["light"])
        sp.disc(x, y - 30, 4, (226, 188, 140))
        sp.rect(x - 7, y - 33, 14, 2, THATCH["base"]); sp.rect(x - 4, y - 37, 8, 4, THATCH["base"]); sp.rect(x - 4, y - 37, 8, 1, THATCH["light"])
        sp.rect(x - 2, y - 31, 1, 1, TAR["dark"]); sp.rect(x + 1, y - 31, 1, 1, TAR["dark"])
    sp.finish()
    return sp.a, sp.anchor()


def tree(sp, x, y, r, fruit=True, sway=0, glass=False):
    sp.rect(x - 1, y - 6, 3, 6, WOOD["base"]); sp.rect(x - 1, y - 6, 1, 6, WOOD["light"])
    cy = y - 6 - r
    sp.disc(x + sway, cy, r + 1, LEAF[2]); sp.disc(x + sway, cy, r, LEAF[1]); sp.disc(x + sway - 1, cy - 1, max(1, r - 2), LEAF[0])
    if fruit:
        for k, (dx, dy) in enumerate(((-r // 2, 1), (r // 2, -1), (0, r // 2), (r // 3, r // 3))):
            sp._px(x + sway + dx, cy + dy, (206, 58, 48))


def town_field(st, fi, U=1):
    sp = B2(U, 70 + 24 * (U - 1), 810 + st, span=1.0)
    P = sp.P
    sp.fill([P(0.0, 1.0), P(1.0, 1.0), P(1.0, 0.0), P(0.0, 0.0)], lambda x, y: LEAF[1] if hsh(int(x) // 2, int(y), 5) > 0.15 else LEAF[2], edge=None)
    n = 3 + st // 2 + (U - 1) * 2
    trees = []
    for ia in range(n):
        for ib in range(n):
            a, b = 0.16 + ia * 0.68 / max(1, n - 1), 0.16 + ib * 0.68 / max(1, n - 1)
            trees.append((a + b, a, b))
    for _, a, b in sorted(trees):
        x, y = P(a, b, 0)
        sway = [-1, 0, 1][(fi + int(a * 7 + b * 5)) % 3] if st >= 1 else 0
        tree(sp, int(x), int(y), 4 if st == 0 else 6, fruit=st >= 2, sway=sway)
    if st >= 1:
        fence(sp, 0.03, 0.03, 0.97, 0.97, 4, 6, stone=True)
    if st >= 3:     # beehives
        for (a, b) in ((0.88, 0.2), (0.78, 0.12)):
            x, y = P(a, b, 0)
            sp.rect(int(x) - 3, int(y) - 6, 6, 6, THATCH["base"]); sp.rect(int(x) - 3, int(y) - 7, 6, 1, THATCH["light"]); sp.rect(int(x) - 1, int(y) - 3, 2, 2, TAR["base"])
    if st >= 5 and U >= 2:          # a little windmill at the back
        x, y = P(0.14, 0.14, 0)
        sp.cyl(0.14, 0.14, 0.07, 0, 30, "brick", BRICK, salt=3, top=False)
        sp.cone(0.14, 0.14, 0.09, 30, 12, "tile", TILE, salt=4)
        cx, cy = int(x), int(y) - 26
        for k in range(4):
            ang = k * np.pi / 2 + 0.5
            sp.line((cx, cy), (cx + np.cos(ang) * 14, cy + np.sin(ang) * 14), WOOD["base"], 2)
            sp.line((cx + np.cos(ang) * 6, cy + np.sin(ang) * 6), (cx + np.cos(ang) * 14, cy + np.sin(ang) * 14), CANVAS["light"], 3)
    sp.finish()
    return sp.a, sp.anchor()


def city_field(st, fi, U=1):
    sp = B2(U, 70 + 30 * (U - 1) * 1.4, 820 + st, span=1.0)
    P = sp.P
    sp.fill([P(0.0, 1.0), P(1.0, 1.0), P(1.0, 0.0), P(0.0, 0.0)], lambda x, y: (96, 96, 90) if hsh(int(x) // 2, int(y), 6) > 0.2 else (80, 80, 76), edge=None)
    sp.fill([P(0.06, 0.94), P(0.94, 0.94), P(0.94, 0.06), P(0.06, 0.06)], lambda x, y: SOIL["base"] if hsh(int(x) // 2, int(y), 7) > 0.25 else SOIL["shade"], edge=None)
    nb = 3 + (U - 1) * 2
    for i in range(nb):               # raised allotment beds
        b0 = 0.10 + i * (0.8 / nb); b1 = b0 + 0.8 / nb - 0.05
        sp.box(0.10, b0, 0.90, b1, 0, 3, "plank", PLANK, salt=i)
        for k in range(8):
            a = 0.14 + k * 0.1
            x, y = P(a, (b0 + b1) / 2, 3)
            sway = [-1, 0, 1][(fi + k + i) % 3]
            stalk(sp, int(x), int(y), 4, LEAF, sway)
    if st >= 1:    # glass cold frames / greenhouse volume grows with the look
        gh = [0, 8, 16, 22, 24, 30, 36][st]
        a0, a1 = (0.16, 0.84) if st < 3 else (0.10, 0.90)
        b0, b1 = (0.22, 0.52) if st < 4 else (0.14, 0.70)
        sp.box(a0, b0, a1, b1, 0, gh, "glass", GLASSB, salt=3)
        sp.hip(a0 - 0.01, b0 - 0.01, a1 + 0.01, b1 + 0.01, gh, 6 + gh // 4, "glass", GLASSB, k=0.1)
        if st >= 3:
            sp.dome((a0 + a1) / 2, (b0 + b1) / 2, 0.14, gh + 4 + gh // 4, 12, "glass", GLASSB, salt=5, ribs=6)
        for i in range(1, 4):
            a = a0 + (a1 - a0) * i / 4
            sp.line(P(a, b1, 0), P(a, b1, gh), GLASSB["dark"])
    if st >= 5:        # a stone fountain and a brass pump
        x, y = P(0.82, 0.86, 0)
        sp.disc(int(x), int(y) - 3, 6, STONE["base"]); sp.disc(int(x), int(y) - 3, 4, (96, 150, 190))
        sp.line((x, y - 3), (x, y - 12), BRASS["base"], 2)
    sp.finish()
    return sp.a, sp.anchor()


def field(era, st, fi, U=1):
    return {"village": lambda: village_field(st, fi), "town": lambda: town_field(st, fi, U), "city": lambda: city_field(st, fi, U)}[era]()
