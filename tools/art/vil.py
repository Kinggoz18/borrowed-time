"""Village (Hearth & Harvest): thatch, daub and timber, fieldstone. 4 looks per type, every step changes the outline.
Each builder returns (rgba, anchors) for one 1x1 lot (the era never claims more than that)."""
import numpy as np
from b2 import *

def S(U=1, hmax=96, seed=1):
    return B2(U, hmax, seed)

def timber_wall(sp, a0, b0, a1, b1, z0, h, salt=0, posts=3, plaster=True):
    """daub walls with dark timber framing on the two visible faces"""
    sp.box(a0, b0, a1, b1, z0, h, "daub", DAUB, salt=salt)
    P = sp.P
    # vertical posts on the left (b = b1) and right (a = a1) faces, a diagonal brace on the left
    for i in range(posts + 1):
        a = a0 + (a1 - a0) * i / posts
        sp.line(P(a, b1, z0), P(a, b1, z0 + h), WOOD["shade"], 1)
    for i in range(0, posts + 1, 2 if posts > 2 else 1):
        b = b0 + (b1 - b0) * i / posts
        sp.line(P(a1, b, z0), P(a1, b, z0 + h), WOOD["dark"], 1)
    sp.line(P(a0, b1, z0 + h), P(a1, b1, z0 + h), WOOD["base"], 1)
    sp.line(P(a1, b1, z0 + h), P(a1, b0, z0 + h), WOOD["dark"], 1)
    sp.line(P(a0, b1, z0), P(a1, b1, z0), WOOD["base"], 1)
    sp.line(P(a0, b1, z0 + 1), P(a0 + (a1 - a0) / posts, b1, z0 + h - 1), WOOD["shade"], 1)

def door(sp, a, z, w=0.16, h=14, plane="L", blue=False, b1=1.0):
    sp.opening(plane, a, z, w, h, door=True, frame=WOOD, b1=b1)
    if blue:
        P = sp.P
        pts = [P(a + 0.02, b1, z + h - 1), P(a + w - 0.02, b1, z + h - 1), P(a + w - 0.02, b1, z + 1), P(a + 0.02, b1, z + 1)]
        sp.fill(pts, lambda x, y: (92, 142, 176) if (int(x) + int(y)) % 7 else (60, 104, 140), edge=WOOD["dark"])

def cottage(st):
    sp = S(1, 96, 3 + st)
    anc = {}
    if st == 0:      # round wattle hut under a low thatch cone
        sp.cyl(0.5, 0.52, 0.30, 0, 15, "plank", WOOD, salt=4, top=False)
        sp.opening("L", 0.40, 0, 0.14, 11, door=True) if False else None
        x, y = sp.P(0.5, 0.52 + 0.30, 0)
        sp.rect(int(x) - 4, int(y) - 12, 8, 12, TAR["base"]); sp.rect(int(x) - 4, int(y) - 12, 8, 1, WOOD["light"])
        sp.cone(0.5, 0.52, 0.38, 14, 22, "thatch", THATCH, salt=2, droop=3)
        sp.rect(int(sp.P(0.5, 0.52, 36)[0]) - 1, int(sp.P(0.5, 0.52, 36)[1]) - 3, 3, 3, THATCH["dark"])
    elif st == 1:    # long hut, hipped thatch, stone chimney stack
        timber_wall(sp, 0.12, 0.28, 0.88, 0.74, 0, 17, 5, 4)
        door(sp, 0.30, 0, 0.14, 12, b1=0.74)
        sp.opening("L", 0.58, 5, 0.12, 7, b1=0.74)
        sp.hip(0.06, 0.22, 0.94, 0.80, 17, 20, "thatch", THATCH, k=0.2, salt=6, end_ramp=THATCH)
        sp.chimney(0.74, 0.30, 17, 20, 0.14, FIELDSTONE, pot=True)
        anc["chimney"] = sp.P(0.81, 0.37, 41)
    elif st == 2:    # tall A-frame: steep thatch to the ground, timber gable end with a blue door, crossed ridge poles
        sp.box(0.22, 0.3, 0.78, 0.7, 0, 6, "daub", DAUB, salt=7)
        sp.gable(0.16, 0.22, 0.84, 0.78, 6, 44, "thatch", THATCH, ridge="b", salt=8, end_mat="daub", end_ramp=DAUB, over=0.0)
        P = sp.P
        # gable-end framing (left end faces +b? ridge along b so the visible end is the left plane a0 side -> we show the b = b1 end)
        sp.line(P(0.16, 0.78, 6), P(0.5, 0.78, 50), WOOD["dark"]); sp.line(P(0.84, 0.78, 6), P(0.5, 0.78, 50), WOOD["dark"])
        sp.line(P(0.5, 0.78, 6), P(0.5, 0.78, 46), WOOD["shade"])
        sp.line(P(0.33, 0.78, 16), P(0.67, 0.78, 16), WOOD["shade"])
        door(sp, 0.42, 6, 0.16, 15, blue=True, b1=0.78)
        sp.opening("L", 0.44, 26, 0.12, 8, b1=0.78)
        # crossed ridge poles
        x, y = P(0.5, 0.3, 50); sp.line((x - 5, y - 8), (x + 5, y + 2), WOOD["base"], 1); sp.line((x + 5, y - 8), (x - 5, y + 2), WOOD["base"], 1)
        sp.chimney(0.8, 0.5, 14, 22, 0.12, FIELDSTONE) if False else None
    else:            # two-storey daub house, jettied upper floor, thatch gable and a chimney
        sp.box(0.14, 0.26, 0.86, 0.74, 0, 17, "daub", DAUB, salt=9)
        for i in range(5):
            a = 0.14 + 0.72 * i / 4; sp.line(sp.P(a, 0.74, 0), sp.P(a, 0.74, 17), WOOD["shade"])
        door(sp, 0.26, 0, 0.14, 12, blue=True, b1=0.74)
        sp.opening("L", 0.56, 5, 0.12, 8, b1=0.74)
        sp.box(0.10, 0.22, 0.90, 0.80, 17, 18, "daub", DAUB, salt=10)       # jetty: the upper floor overhangs
        sp.line(sp.P(0.10, 0.80, 17), sp.P(0.90, 0.80, 17), WOOD["base"]); sp.line(sp.P(0.10, 0.80, 18), sp.P(0.90, 0.80, 18), WOOD["dark"])
        for i in range(5):
            a = 0.10 + 0.80 * i / 4; sp.line(sp.P(a, 0.80, 17), sp.P(a, 0.80, 35), WOOD["dark"])
        sp.opening("L", 0.20, 21, 0.14, 9, b1=0.80); sp.opening("L", 0.64, 21, 0.14, 9, lit=True, b1=0.80)
        sp.gable(0.06, 0.18, 0.94, 0.84, 35, 22, "thatch", THATCH, ridge="a", salt=11, end_mat="daub", end_ramp=DAUB)
        sp.chimney(0.18, 0.30, 35, 18, 0.14, FIELDSTONE, pot=True)
        anc["chimney"] = sp.P(0.25, 0.37, 55)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc


def gear_on(sp, a, b, z, r, ramp=BRASS, plane="R", spin=0.0):
    x, y = sp.P(a, b, z)
    sp.gear(int(x), int(y), r, ramp, spin=spin)

def workshop(st):
    sp = S(1, 96, 20 + st)
    P = sp.P
    anc = {}
    if st == 0:      # bench + vice, a small gear leaning on it
        sp.box(0.20, 0.32, 0.82, 0.62, 0, 13, "hplank", PLANK, salt=3)
        sp.box(0.18, 0.28, 0.86, 0.66, 13, 3, "hplank", WOOD, salt=4)
        sp.box(0.32, 0.36, 0.44, 0.50, 16, 7, "plank", IRON, salt=5)             # vice
        sp.box(0.62, 0.38, 0.74, 0.52, 16, 5, "plank", STONE, salt=6)           # anvil block
        x, y = P(0.88, 0.5, 14); sp.gear(int(x), int(y) - 4, 7, BRASS)
        for a in (0.24, 0.78):
            sp.post(a, 0.64, 0, 3, 3, WOOD, cap=False)
    elif st == 1:    # open lean-to: 4 posts, back wall, a sloping thatch roof over a bench, a gear on the back wall
        sp.box(0.14, 0.14, 0.86, 0.22, 0, 30, "plank", WOOD, salt=8)
        sp.box(0.14, 0.14, 0.22, 0.80, 0, 30, "plank", WOOD, salt=9)
        sp.box(0.34, 0.48, 0.74, 0.72, 0, 11, "hplank", PLANK, salt=10)
        sp.box(0.38, 0.52, 0.52, 0.68, 11, 4, "plank", IRON, salt=11)
        for a, b in ((0.14, 0.84), (0.86, 0.84), (0.86, 0.22)):
            sp.post(a, b, 0, 34, 4, WOOD)
        # lean-to roof: high at the back (b0), low at the front
        top = [P(0.08, 0.10, 40), P(0.94, 0.10, 40), P(0.94, 0.90, 30), P(0.08, 0.90, 30)]
        sp.face([P(0.08, 0.90, 30), P(0.94, 0.90, 30), P(0.94, 0.10, 40), P(0.08, 0.10, 40)], "thatch", THATCH, "top", salt=12, uv=lambda x, y: (x, y))
        sp.line(P(0.08, 0.90, 30), P(0.94, 0.90, 30), THATCH["dark"]); sp.line(P(0.94, 0.90, 30), P(0.94, 0.10, 40), THATCH["shade"])
        gear_on(sp, 0.5, 0.22, 20, 6)
    elif st == 2:    # workshop: plank walls under a thatch gable, big brass gear wheel on the end wall
        sp.box(0.14, 0.24, 0.86, 0.76, 0, 22, "plank", PLANK, salt=13)
        door(sp, 0.30, 0, 0.18, 14, b1=0.76)
        sp.opening("L", 0.62, 8, 0.14, 8, b1=0.76)
        sp.gable(0.08, 0.18, 0.92, 0.82, 22, 20, "thatch", THATCH, ridge="a", salt=14, end_mat="plank", end_ramp=PLANK)
        gear_on(sp, 0.86, 0.5, 15, 10, BRASS)
        sp.chimney(0.2, 0.3, 22, 16, 0.12, FIELDSTONE)
        anc["chimney"] = P(0.26, 0.36, 40)
    else:            # stone-footed works with a treadwheel
        sp.box(0.12, 0.24, 0.84, 0.76, 0, 14, "stone", FIELDSTONE, salt=15)
        sp.box(0.12, 0.24, 0.84, 0.76, 14, 16, "plank", PLANK, salt=16)
        door(sp, 0.28, 0, 0.18, 12, b1=0.76)
        sp.opening("L", 0.60, 18, 0.12, 8, b1=0.76, lit=True)
        sp.gable(0.06, 0.18, 0.90, 0.82, 30, 20, "thatch", THATCH, ridge="a", salt=17, end_mat="plank", end_ramp=PLANK)
        # treadwheel: a big wooden wheel on the right gable end, spokes + rim
        cx, cy = P(0.90, 0.5, 20)
        cx, cy = int(cx) + 2, int(cy) - 4
        sp.disc(cx, cy, 15, WOOD["dark"]); sp.disc(cx, cy, 13, WOOD["base"]); sp.disc(cx, cy, 10, PLANK["shade"])
        for k in range(8):
            ang = k * np.pi / 4
            sp.line((cx, cy), (cx + np.cos(ang) * 12, cy + np.sin(ang) * 12), WOOD["dark"])
        for k in range(8):
            ang = k * np.pi / 4 + np.pi / 8
            sp._px(int(cx + np.cos(ang) * 14), int(cy + np.sin(ang) * 14), WOOD["light"])
        sp.disc(cx, cy, 3, BRASS["base"]); sp.disc(cx, cy, 1, BRASS["dark"])
        sp.chimney(0.18, 0.30, 30, 14, 0.12, FIELDSTONE)
        anc["chimney"] = P(0.24, 0.36, 46)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc

def tower(st):
    sp = S(1, 120, 40 + st)
    P = sp.P
    anc = {}
    def legs(h, w0=0.22, w1=0.78, top0=0.30, top1=0.70, n=2):
        for (a, b, ta, tb) in ((w0, w1, top0, top1), (w1, w1, top1, top1), (w1, w0, top1, top0), (w0, w0, top0, top0)):
            x0, y0 = P(a, b, 0); x1, y1 = P(ta, tb, h)
            sp.line((x0, y0), (x1, y1), WOOD["base"], 3)
            sp.line((x0 - 1, y0), (x1 - 1, y1), WOOD["light"], 1)
    if st == 0:      # log stilts, open top
        legs(34)
        for z in (12, 24):
            f = 1 - z / 34 * 0.2
            sp.line(P(0.26, 0.74, z), P(0.74, 0.74, z), WOOD["dark"], 2)
            sp.line(P(0.74, 0.74, z), P(0.74, 0.26, z), WOOD["dark"], 2)
        sp.box(0.26, 0.26, 0.74, 0.74, 34, 3, "hplank", PLANK, salt=2)
        sp.line(P(0.30, 0.70, 37), P(0.70, 0.70, 37), WOOD["base"]); sp.line(P(0.70, 0.70, 37), P(0.70, 0.30, 37), WOOD["shade"])
        anc["pole"] = P(0.5, 0.5, 52); sp.post(0.5, 0.5, 37, 14, 2, WOOD, cap=False)
    elif st == 1:    # log tower with a platform and a railing, a ladder
        legs(50, 0.20, 0.80, 0.30, 0.70)
        for z in (14, 28, 42):
            sp.line(P(0.26, 0.74, z), P(0.74, 0.74, z), WOOD["dark"], 2); sp.line(P(0.74, 0.74, z), P(0.74, 0.26, z), WOOD["dark"], 2)
        sp.line(P(0.30, 0.74, 5), P(0.30, 0.74, 48), WOOD["light"], 1)
        for z in range(8, 48, 6): sp.line(P(0.27, 0.74, z), P(0.33, 0.74, z), WOOD["light"])
        sp.box(0.22, 0.22, 0.78, 0.78, 50, 3, "hplank", PLANK, salt=3)
        sp.box(0.24, 0.24, 0.76, 0.76, 53, 8, "plank", WOOD, salt=4)
        sp.opening("L", 0.40, 55, 0.2, 4, b1=0.76)
        anc["pole"] = P(0.5, 0.5, 78); sp.post(0.5, 0.5, 61, 17, 2, WOOD, cap=False)
    elif st == 2:    # timber tower, cabin, thatched cap
        legs(48, 0.20, 0.80, 0.28, 0.72)
        for z in (12, 24, 36):
            sp.line(P(0.26, 0.74, z), P(0.74, 0.74, z), WOOD["dark"], 2); sp.line(P(0.74, 0.74, z), P(0.74, 0.26, z), WOOD["dark"], 2)
        sp.box(0.18, 0.18, 0.82, 0.82, 48, 3, "hplank", PLANK, salt=3)
        timber_wall(sp, 0.22, 0.22, 0.78, 0.78, 51, 16, 4, 3)
        sp.opening("L", 0.36, 56, 0.28, 7, b1=0.78)
        sp.hip(0.14, 0.14, 0.86, 0.86, 67, 24, "thatch", THATCH, k=0.0, salt=5)
        anc["pole"] = P(0.5, 0.5, 100); sp.post(0.5, 0.5, 90, 10, 2, WOOD, cap=False)
    else:            # round fieldstone tower, cone thatch, arrow slit and door
        sp.cyl(0.5, 0.5, 0.30, 0, 58, "stone", FIELDSTONE, salt=6, top=False)
        x, y = P(0.5, 0.5 + 0.30, 0)
        sp.rect(int(x) - 4, int(y) - 14, 8, 14, TAR["base"]); sp.rect(int(x) - 4, int(y) - 14, 8, 1, STONE["light"])
        for z in (26, 44):
            x, y = P(0.46, 0.5 + 0.29, z); sp.rect(int(x), int(y) - 4, 2, 6, TAR["base"])
        sp.cone(0.5, 0.5, 0.40, 58, 28, "thatch", THATCH, salt=7, droop=3)
        anc["pole"] = P(0.5, 0.5, 94); sp.post(0.5, 0.5, 80, 14, 2, WOOD, cap=False)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc

def bank(st):
    sp = S(1, 96, 60 + st)
    P = sp.P
    anc = {}
    if st == 0:      # crate with a glass
        sp.box(0.28, 0.30, 0.72, 0.72, 0, 15, "plank", PLANK, salt=14)
        for z in (4, 11):
            sp.line(P(0.28, 0.72, z), P(0.72, 0.72, z), BRASS["shade"]); sp.line(P(0.72, 0.72, z), P(0.72, 0.30, z), BRASS["shade"])
        sp.box(0.32, 0.34, 0.68, 0.68, 15, 3, "hplank", WOOD, salt=15)
        hourglass_at(sp, 0.5, 0.52, 18, 14, 8)
    elif st == 1:    # stall: counter, 4 posts, a flat canvas roof
        sp.box(0.24, 0.30, 0.76, 0.72, 0, 13, "plank", PLANK, salt=16)
        sp.box(0.20, 0.26, 0.80, 0.76, 13, 3, "hplank", WOOD, salt=17)
        for a, b in ((0.18, 0.84), (0.84, 0.84), (0.84, 0.18), (0.18, 0.18)):
            sp.post(a, b, 0, 38, 3, WOOD)
        sp.fill([P(0.12, 0.90, 36), P(0.90, 0.90, 36), P(0.90, 0.12, 44), P(0.12, 0.12, 44)], lambda x, y: CANVAS["light"] if (int(x) // 6) % 2 else CANVAS["base"], edge=CANVAS["dark"])
        hourglass_at(sp, 0.5, 0.52, 16, 14, 8)
    elif st == 2:    # round kiosk
        sp.cyl(0.5, 0.5, 0.28, 0, 24, "plank", WOOD, salt=18, top=False)
        x, y = P(0.5, 0.78, 0)
        sp.rect(int(x) - 6, int(y) - 18, 12, 18, GLASSB["base"]); sp.rect(int(x) - 6, int(y) - 18, 12, 1, WOOD["dark"]); sp.rect(int(x) - 6, int(y) - 18, 1, 18, WOOD["dark"]); sp.rect(int(x) + 5, int(y) - 18, 1, 18, WOOD["dark"])
        sp.rect(int(x) - 2, int(y) - 14, 4, 2, GLASSB["light"])
        hg(sp, int(x), int(y) - 2, 14, 8)
        sp.cone(0.5, 0.5, 0.36, 24, 12, "plank", WOOD, salt=19, droop=2)
        sp.cone(0.5, 0.5, 0.20, 33, 10, "thatch", THATCH, salt=20)
    else:            # thatched rotunda
        sp.cyl(0.5, 0.5, 0.34, 0, 28, "stone", FIELDSTONE, salt=21, top=False)
        sp.cyl(0.5, 0.5, 0.34, 28, 3, "plank", WOOD, salt=22, top=False)
        x, y = P(0.5, 0.84, 0)
        sp.rect(int(x) - 7, int(y) - 22, 14, 22, GLASSB["base"])
        for xx in (int(x) - 7, int(x) + 6): sp.rect(xx, int(y) - 22, 1, 22, WOOD["dark"])
        sp.rect(int(x) - 7, int(y) - 22, 14, 1, WOOD["dark"]); sp.rect(int(x) - 3, int(y) - 18, 3, 3, GLASSB["light"])
        hg(sp, int(x), int(y) - 2, 18, 10)
        sp.cone(0.5, 0.5, 0.42, 31, 26, "thatch", THATCH, salt=23, droop=3)
        anc["pole"] = P(0.5, 0.5, 66); sp.post(0.5, 0.5, 56, 10, 2, WOOD, cap=False)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc

def hg(sp, x, y, h=14, w=8):
    """a pixel hourglass standing on (x, y): frame, two bulbs, falling sand"""
    for i in range(h):
        t = abs((i - h / 2) / (h / 2))
        half = max(0, int(round((1 - t) * (w / 2 - 1)))) if t < 0.92 else 0
        yy = y - i
        sand = SANDC if i < h * 0.42 or i > h * 0.66 and i < h * 0.8 else GLASS["light"]
        for dx in range(-half, half + 1):
            sp._px(x + dx, yy, GLASS["base"] if abs(dx) == half else (SANDC if (i < h * 0.4 or i == int(h * 0.5)) else GLASS["light"]))
    sp.rect(x - w // 2, y - h, w, 1, BRASS["base"]); sp.rect(x - w // 2, y, w, 1, BRASS["base"])
    sp.rect(x - w // 2, y - h, w, 1, BRASS["light"])
SANDC = (236, 196, 96)

def hourglass_at(sp, a, b, z, h=14, w=8):
    x, y = sp.P(a, b, z)
    hg(sp, int(x), int(y), h, w)


def lantern_hall(st):
    sp = S(1, 110, 80 + st)
    P = sp.P
    anc = {}
    def hang(a, b, z):
        x, y = P(a, b, z)
        sp.line((x, y + 2), (x, y + 5), WOOD["dark"])
        sp.rect(int(x) - 2, int(y) + 5, 4, 5, BRASS["dark"]); sp.rect(int(x) - 1, int(y) + 6, 2, 3, WARM_LIGHT)
    if st == 0:      # lantern tent: a small cloth tent ringed with hanging lanterns
        sp.prism(0.22, 0.24, 0.78, 0.76, 0, 24, "b", "cloth", CANVAS, salt=3)
        sp.box(0.22, 0.24, 0.78, 0.76, 0, 4, "plank", WOOD, salt=4) if False else None
        P = sp.P
        sp.line(P(0.22, 0.76, 0), P(0.78, 0.76, 0), WOOD["dark"])
        for a in (0.30, 0.70): sp.post(a, 0.84, 0, 14, 2, WOOD, cap=False); hang(a, 0.84, 14)
        anc["pole"] = P(0.5, 0.5, 38); sp.post(0.5, 0.5, 24, 14, 2, WOOD, cap=False)
    elif st == 1:    # pavilion: four posts, a hipped thatch roof, lanterns in the eaves
        sp.box(0.16, 0.16, 0.84, 0.84, 0, 4, "stone", FIELDSTONE, salt=5)
        for a, b in ((0.18, 0.82), (0.82, 0.82), (0.82, 0.18), (0.18, 0.18)):
            sp.post(a, b, 4, 32, 4, WOOD)
        sp.hip(0.08, 0.08, 0.92, 0.92, 36, 22, "thatch", THATCH, k=0.2, salt=6)
        for a in (0.30, 0.55, 0.78): hang(a, 0.9, 36)
        hang(0.9, 0.5, 36)
    elif st == 2:    # long timber hall with lantern eaves
        timber_wall(sp, 0.08, 0.28, 0.92, 0.72, 0, 20, 6, 6)
        door(sp, 0.44, 0, 0.14, 13, b1=0.72)
        for a in (0.16, 0.30, 0.62, 0.76): sp.opening("L", a, 6, 0.08, 8, b1=0.72, lit=True)
        sp.gable(0.02, 0.22, 0.98, 0.78, 20, 22, "thatch", THATCH, ridge="a", salt=7, end_mat="daub", end_ramp=DAUB)
        for a in (0.12, 0.28, 0.44, 0.60, 0.76, 0.90): hang(a, 0.78, 20)
    else:            # long hall + the Hesper pennant on a tall pole
        timber_wall(sp, 0.08, 0.28, 0.92, 0.72, 0, 22, 6, 6)
        door(sp, 0.44, 0, 0.14, 14, b1=0.72, blue=True)
        for a in (0.16, 0.30, 0.62, 0.76): sp.opening("L", a, 7, 0.08, 9, b1=0.72, lit=True)
        sp.gable(0.02, 0.22, 0.98, 0.78, 22, 22, "thatch", THATCH, ridge="a", salt=8, end_mat="daub", end_ramp=DAUB)
        sp.box(0.40, 0.46, 0.60, 0.62, 40, 8, "daub", DAUB, salt=9)                 # a little lantern cupola on the ridge
        sp.opening("L", 0.45, 42, 0.10, 4, b1=0.62, lit=True)
        sp.gable(0.36, 0.42, 0.64, 0.66, 48, 8, "thatch", THATCH, ridge="a", salt=10, end_mat="daub", end_ramp=DAUB)
        for a in (0.12, 0.28, 0.44, 0.60, 0.76, 0.90): hang(a, 0.78, 22)
        sp.post(0.9, 0.34, 22, 30, 2, WOOD, cap=False)
        x, y = P(0.9, 0.34, 52)
        for i in range(10): sp.rect(int(x) + 1 + i, int(y) + i // 3, 1, 8 - i // 2, STRIPE_RED["base"] if i % 3 else STRIPE_RED["light"])
        anc["pole"] = P(0.9, 0.34, 52)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc

def crate(sp, a, b, z, s=0.16, h=9, salt=0):
    sp.box(a, b, a + s, b + s, z, h, "plank", PLANK, salt=salt)
    sp.line(sp.P(a, b + s, z + h - 2), sp.P(a + s, b + s, z + h - 2), WOOD["dark"])

def trade(st):
    sp = S(1, 96, 100 + st)
    P = sp.P
    anc = {}
    if st == 0:      # shore crates: three crates and a barrel
        crate(sp, 0.18, 0.40, 0, 0.26, 12, 1); crate(sp, 0.50, 0.32, 0, 0.24, 11, 2); crate(sp, 0.34, 0.40, 12, 0.20, 9, 3)
        sp.cyl(0.74, 0.70, 0.12, 0, 13, "plank", WOOD, salt=4)
    elif st == 1:    # awning stall: counter, a striped awning pitched over it, crates
        sp.box(0.20, 0.34, 0.80, 0.72, 0, 12, "plank", PLANK, salt=5)
        sp.box(0.16, 0.30, 0.84, 0.76, 12, 3, "hplank", WOOD, salt=6)
        for a, b in ((0.14, 0.86), (0.86, 0.86), (0.14, 0.18), (0.86, 0.18)):
            sp.post(a, b, 0, 34 if b > 0.5 else 42, 3, WOOD)
        sp.fill([P(0.10, 0.90, 34), P(0.92, 0.90, 34), P(0.92, 0.14, 44), P(0.10, 0.14, 44)], lambda x, y: STRIPE_RED["light"] if (int(x) // 5) % 2 else CANVAS["light"], edge=STRIPE_RED["dark"])
        crate(sp, 0.30, 0.44, 15, 0.16, 8, 7); crate(sp, 0.56, 0.44, 15, 0.16, 8, 8)
    elif st == 2:    # warehouse: a long plank hall with a big sliding door and a hoist beam
        sp.box(0.10, 0.28, 0.90, 0.76, 0, 22, "plank", PLANK, salt=9)
        sp.opening("L", 0.36, 0, 0.26, 17, door=True, b1=0.76, frame=WOOD)
        sp.line(P(0.49, 0.76, 0), P(0.49, 0.76, 17), WOOD["base"])
        for a, z in ((0.36, 0), (0.62, 0)): pass
        sp.gable(0.04, 0.22, 0.96, 0.82, 22, 20, "thatch", THATCH, ridge="a", salt=10, end_mat="plank", end_ramp=PLANK)
        sp.opening("L", 0.18, 8, 0.1, 7, b1=0.76); sp.opening("L", 0.76, 8, 0.1, 7, b1=0.76)
        crate(sp, 0.74, 0.80, 0, 0.14, 8, 11); crate(sp, 0.12, 0.80, 0, 0.14, 8, 12)
    else:            # counting shed with a sail flag on a mast
        sp.box(0.12, 0.32, 0.72, 0.76, 0, 20, "plank", PLANK, salt=13)
        sp.opening("L", 0.20, 0, 0.14, 13, door=True, b1=0.76)
        sp.opening("L", 0.46, 7, 0.14, 8, b1=0.76, lit=True)
        sp.gable(0.06, 0.26, 0.78, 0.82, 20, 16, "thatch", THATCH, ridge="a", salt=14, end_mat="plank", end_ramp=PLANK)
        # awning over the counter + crates
        sp.fill([P(0.50, 0.92, 22), P(0.90, 0.92, 22), P(0.90, 0.56, 30), P(0.50, 0.56, 30)], lambda x, y: STRIPE_RED["light"] if (int(x) // 5) % 2 else CANVAS["light"], edge=STRIPE_RED["dark"])
        sp.post(0.5, 0.92, 0, 22, 2, WOOD, cap=False); sp.post(0.9, 0.92, 0, 22, 2, WOOD, cap=False)
        crate(sp, 0.56, 0.70, 0, 0.14, 8, 15); crate(sp, 0.74, 0.70, 0, 0.14, 8, 16)
        # mast with a sail-cloth flag
        sp.post(0.84, 0.30, 0, 58, 2, WOOD, cap=False)
        x, y = P(0.84, 0.30, 58)
        for i in range(12): sp.rect(int(x) + 1 + i, int(y) + 2 + i // 4, 1, 14 - i // 2, CANVAS["light"] if i % 4 else CANVAS["base"])
        anc["pole"] = P(0.84, 0.30, 58)
    sp.finish(); sp.shadow()
    return sp.a, sp.anchor(), anc
