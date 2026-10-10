"""Six cosmetic landmarks tied to docs/LORE.md (no gameplay effect). Town: the Town Clock, the Founders' Wreck, Hesper's First Bargain.
City: the Great Dial, the Lighthouse, the Tide-Bell. Drawn with the same iso renderer as the building models; the anchor is the front
corner of the cell they stand on."""
import numpy as np
from b2 import *
from vil import hg, hourglass_at, SANDC

FACE_W = (250, 244, 228)


def finish(sp):
    sp.finish()
    sp.shadow()
    return sp.a, sp.anchor()


def clock_face(sp, plane, a, b, z, r=7):
    x, y = sp.P(a, b, z)
    x, y = int(x), int(y)
    sp.disc(x, y, r + 1, BRASS["dark"])
    sp.disc(x, y, r, BRASS["base"])
    sp.disc(x, y, r - 1, FACE_W)
    for k in range(12):
        ang = k * np.pi / 6
        sp._px(int(round(x + np.cos(ang) * (r - 2))), int(round(y + np.sin(ang) * (r - 2))), INK_C)
    sp.line((x, y), (x + 2, y - 3), INK_C)        # hands: a little past two (the hour is never on time)
    sp.line((x, y), (x - 3, y - 1), INK_C)
    sp._px(x, y, BRASS["dark"])


INK_C = (61, 52, 40)


def clock(era_seed=3):
    """The Town Clock: a brick tower with marble bands, a clock on both faces, a copper roof and a pennant."""
    sp = B2(1, 190, seed=era_seed)
    P = sp.P
    sp.box(0.06, 0.06, 0.94, 0.94, 0, 4, "stone", STONE)
    sp.box(0.10, 0.10, 0.90, 0.90, 4, 3, "stone", STONE)
    sp.box(0.20, 0.20, 0.80, 0.80, 7, 92, "brick", BRICK, salt=3)
    for z in (30, 58, 86):
        sp.box(0.18, 0.18, 0.82, 0.82, z, 3, "marble", MARBLE)
    for z, lit in ((18, False), (44, True), (70, False)):                    # slits
        sp.opening("L", 0.44, z, 0.12, 12, b1=0.8, lit=lit, arch=True, frame=MARBLE)
        sp.opening("R", 0.44, z, 0.12, 12, a1=0.8, lit=lit, arch=True, frame=MARBLE)
    sp.opening("L", 0.40, 7, 0.2, 16, b1=0.8, door=True, arch=True, frame=MARBLE)
    sp.box(0.14, 0.14, 0.86, 0.86, 99, 30, "marble", MARBLE, salt=5)           # clock stage
    sp.box(0.12, 0.12, 0.88, 0.88, 129, 4, "marble", MARBLE)
    clock_face(sp, "L", 0.5, 0.86, 114, 9)
    clock_face(sp, "R", 0.86, 0.5, 114, 9)
    sp.hip(0.14, 0.14, 0.86, 0.86, 133, 34, "tile", COPPER, k=0.0, ridge="a", salt=9)
    sp.post(0.5, 0.5, 164, 18, 2, BRASS, cap=True)
    sp.pennant(0.5, 0.5, 172, 12)
    hourglass_at(sp, 0.5, 0.86, 134, 7, 5)
    return finish(sp)


def wreck():
    """The Founders' Wreck: the Patience's hull hauled up the beach: ribs, a snapped mast, torn canvas and a brass plate on a stone."""
    sp = B2(2, 90, seed=11)
    P = sp.P
    # sand drift under the hull
    sp.fill([P(0.10, 0.60, 0), P(0.90, 0.60, 0), P(0.90, 0.28, 0), P(0.10, 0.28, 0)], lambda x, y: (214, 198, 150) if (x + y) % 3 else (200, 182, 136), edge=None)
    # hull: a long keel box with side planking rising to the bow (b along hull is a)
    sp.box(0.14, 0.34, 0.86, 0.54, 3, 8, "hplank", DRIFT_R, salt=5)
    sp.box(0.20, 0.30, 0.80, 0.34, 11, 9, "hplank", DRIFT_R, salt=6)             # near side planks
    sp.box(0.20, 0.54, 0.80, 0.58, 11, 14, "hplank", DRIFT_R, salt=7)
    sp.box(0.72, 0.30, 0.86, 0.58, 3, 20, "hplank", DRIFT_R, salt=8)             # raised bow
    # ribs standing up where the planking is gone
    for a in (0.30, 0.40, 0.50, 0.60):
        sp.post(a, 0.56, 11, 24, 2, DRIFT_R)
        sp.post(a, 0.32, 11, 16, 2, DRIFT_R)
    # snapped mast, torn sail
    sp.post(0.46, 0.44, 11, 46, 3, DRIFT_R, cap=False)
    sp.fill([P(0.46, 0.44, 52), P(0.46, 0.44, 22), P(0.30, 0.50, 18), P(0.34, 0.50, 34), P(0.40, 0.47, 44)], lambda x, y: CANVAS["light"] if (x // 3) % 2 else CANVAS["base"], edge=CANVAS["dark"])
    # a coil of rope, a brass-plated stone with the founders' mark
    sp.box(0.12, 0.70, 0.28, 0.82, 0, 8, "stone", STONE, salt=9)
    x, y = P(0.20, 0.82, 4)
    sp.rect(int(x) - 3, int(y) - 3, 6, 4, BRASS["base"]); sp.rect(int(x) - 3, int(y) - 3, 6, 1, BRASS["light"])
    sp.box(0.62, 0.70, 0.74, 0.80, 0, 3, "hplank", ROPE, salt=3)
    return finish(sp)


DRIFT_R = {"light": (176, 156, 128), "base": (140, 122, 100), "shade": (96, 82, 66), "dark": (56, 46, 38)}


def bargain():
    """Hesper's First Bargain: a round stone basin, a pedestal and a brass hand holding an hourglass over the water."""
    sp = B2(1, 120, seed=17)
    P = sp.P
    sp.cyl(0.5, 0.5, 0.44, 0, 8, "stone", STONE, salt=2, top=True)
    sp.cyl(0.5, 0.5, 0.36, 8, 1, "marble", MARBLE, salt=3, top=False)
    cx, cy0, rx, ry = sp._ellipse(0.5, 0.5, 0.33)
    for x in range(int(cx - rx), int(cx + rx) + 1):                              # water
        t = (x + 0.5 - cx) / rx
        if abs(t) > 1:
            continue
        fy = ry * np.sqrt(1 - t * t)
        for y in range(int(round(cy0 - 8 - fy)), int(round(cy0 - 8 + fy)) + 1):
            sp._px(x, y, TEAL["light"] if (x + y) % 4 == 0 else TEAL["base"] if (x * 3 + y) % 7 else TEAL["shade"])
    sp.cyl(0.5, 0.5, 0.10, 8, 22, "marble", MARBLE, salt=4, top=True)
    sp.cyl(0.5, 0.5, 0.16, 30, 4, "marble", MARBLE, salt=5, top=True)
    # the brass hand: a forearm rising from the plinth and a fist cup
    x, y = P(0.5, 0.5, 34)
    x, y = int(x), int(y)
    sp.rect(x - 2, y - 14, 4, 14, BRASS["base"]); sp.rect(x - 2, y - 14, 1, 14, BRASS["light"]); sp.rect(x + 1, y - 14, 1, 14, BRASS["shade"])
    sp.rect(x - 4, y - 18, 8, 5, BRASS["base"]); sp.rect(x - 4, y - 18, 8, 1, BRASS["light"])
    hg(sp, x, y - 19, 14, 8)
    # spray
    for k, (dx, dy) in enumerate([(-7, -8), (7, -9), (-10, -4), (10, -5), (-4, -12), (4, -13)]):
        sp._px(x + dx, y - 14 + dy + 18, GLASS["light"])
    sp.lamp_post(0.12, 0.88, 22)
    return finish(sp)


def dial():
    """The Great Dial: two stone piers carry a huge brass dial ring, hour ticks, a gnomon needle and lamps. It is never finished: scaffolding on one side."""
    sp = B2(1, 170, seed=23)
    P = sp.P
    sp.box(0.04, 0.12, 0.96, 0.88, 0, 5, "stone", STONE)
    sp.box(0.12, 0.62, 0.30, 0.88, 5, 96, "stone", STONE, salt=3)          # left pier (towards the viewer on the left)
    sp.box(0.70, 0.12, 0.88, 0.38, 5, 96, "stone", STONE, salt=4)          # right pier
    for p in ((0.12, 0.62), (0.70, 0.12)):
        sp.box(p[0] - 0.02, p[1] - 0.02, p[0] + 0.20, p[1] + 0.28, 101, 4, "marble", MARBLE)
    cx, cy = P(0.5, 0.5, 70)
    cx, cy = int(cx), int(cy)
    R = 40
    sp.disc(cx, cy, R + 3, BRASS["dark"])
    sp.disc(cx, cy, R + 1, BRASS["base"])
    sp.disc(cx, cy, R - 4, (234, 226, 204))
    sp.disc(cx, cy, R - 6, (222, 212, 186))
    for k in range(60):
        ang = k * np.pi / 30
        r0 = R - 4 if k % 5 == 0 else R - 3
        r1 = R - 9 if k % 5 == 0 else R - 5
        sp.line((cx + np.cos(ang) * r0, cy + np.sin(ang) * r0), (cx + np.cos(ang) * r1, cy + np.sin(ang) * r1), INK_C if k % 5 == 0 else BRASS["shade"])
    sp.gear(cx, cy, 8, BRASS, teeth=10, hub=True)
    sp.gear(cx - 24, cy + 20, 7, BRASS, teeth=8, hub=True, spin=0.3)
    sp.line((cx, cy), (cx + 14, cy - 22), BRASS["dark"], 2)               # the needle: an hour that is always a little later
    sp.line((cx, cy), (cx - 20, cy - 6), BRASS["dark"], 1)
    sp.disc(cx, cy, 2, BRASS["light"])
    for ang in (0, 90, 180, 270):
        a = np.radians(ang - 45)
        sp.disc(cx + np.cos(a) * (R + 6), cy + np.sin(a) * (R + 6), 3, WARM_LIGHT)
    # unfinished: a scaffold of poles and planks at one side of the ring
    for a, b in ((0.72, 0.44), (0.82, 0.44)):
        sp.post(a, b, 5, 60, 2, WOOD)
    sp.box(0.70, 0.40, 0.88, 0.50, 40, 2, "hplank", PLANK)
    sp.box(0.70, 0.40, 0.88, 0.50, 62, 2, "hplank", PLANK)
    sp.lamp_post(0.10, 0.94, 26)
    sp.lamp_post(0.94, 0.10, 26)
    return finish(sp)


def lighthouse():
    """The Lighthouse: a tall tapered tower in cream and Hesper-red bands, a gallery, a lantern room that keeps burning, a copper cap."""
    sp = B2(1, 230, seed=29)
    P = sp.P
    sp.cyl(0.5, 0.5, 0.46, 0, 6, "stone", STONE, salt=1, top=False)
    bands = [(6, 26, 0.34, CREAM_R), (32, 26, 0.31, STRIPE_RED), (58, 26, 0.28, CREAM_R), (84, 26, 0.25, STRIPE_RED), (110, 22, 0.22, CREAM_R)]
    for z, h, rho, ramp in bands:
        sp.cyl(0.5, 0.5, rho, z, h, "marble", ramp, salt=z, top=False)
    sp.opening("L", 0.44, 14, 0.12, 14, b1=0.84, door=True, arch=True, frame=MARBLE)
    for z in (44, 70, 96):
        sp.opening("L", 0.47, z, 0.06, 8, b1=0.80 - (z - 44) * 0.0006, glass=True, lit=True, frame=MARBLE)
    sp.cyl(0.5, 0.5, 0.29, 132, 4, "stone", STONE, salt=4, top=True)       # gallery
    for k in range(10):
        ang = k * 2 * np.pi / 10
        x, y = P(0.5 + 0.27 * np.cos(ang) * 0.9, 0.5 + 0.27 * np.sin(ang) * 0.9, 136)
        sp.rect(int(x), int(y) - 5, 1, 5, IRON["base"])
    cx, cy = P(0.5, 0.5, 148)
    sp.rect(int(cx) - 9, int(cy) - 8, 18, 22, GLASSB["base"])
    sp.rect(int(cx) - 7, int(cy) - 6, 14, 18, WARM_LIGHT)
    sp.rect(int(cx) - 3, int(cy) - 2, 6, 8, WARM_CORE)
    for dx in (-9, -3, 3, 8):
        sp.rect(int(cx) + dx, int(cy) - 8, 1, 22, IRON["dark"])
    sp.rect(int(cx) - 10, int(cy) - 9, 20, 2, COPPER["shade"])
    sp.cone(0.5, 0.5, 0.22, 156, 24, "tile", COPPER, salt=6)
    sp.post(0.5, 0.5, 178, 14, 2, BRASS, cap=True)
    return finish(sp)


CREAM_R = {"light": (250, 240, 218), "base": (236, 222, 192), "shade": (190, 174, 146), "dark": (110, 98, 80)}


def bell():
    """The Tide-Bell: four stone piers and arches under a slate hip, a great brass bell on a beam, a rope nobody admits to pulling."""
    sp = B2(1, 150, seed=31)
    P = sp.P
    sp.box(0.10, 0.10, 0.90, 0.90, 0, 5, "stone", STONE)
    for a, b in ((0.16, 0.16), (0.76, 0.16), (0.16, 0.76), (0.76, 0.76)):
        sp.box(a, b, a + 0.10, b + 0.10, 5, 66, "stone", STONE, salt=int(a * 90 + b * 30))
    sp.box(0.14, 0.14, 0.88, 0.88, 71, 5, "stone", STONE)
    # the beam and the bell, seen through the front arch
    sp.box(0.20, 0.44, 0.82, 0.54, 60, 4, "plank", WOOD)
    x, y = P(0.5, 0.49, 60)
    x, y = int(x), int(y)
    for dy in range(0, 24):
        half = int(3 + 9 * (dy / 23.0) ** 1.5)
        for dx in range(-half, half + 1):
            c = BRASS["light"] if dx < -half // 2 else BRASS["shade"] if dx > half // 2 else BRASS["base"]
            if dy % 8 == 7 or abs(dx) == half:
                c = BRASS["dark"]
            sp._px(x + dx, y + 2 + dy, c)
    sp.rect(x - 2, y + 24, 4, 3, BRASS["dark"])
    sp.line((x, y + 27), (x, y + 38), ROPE["base"])
    sp.hip(0.10, 0.10, 0.90, 0.90, 76, 44, "slate", SLATE2, k=0.0, ridge="a", salt=4)
    sp.post(0.5, 0.5, 118, 16, 2, IRON, cap=True)
    hourglass_at(sp, 0.5, 0.88, 76, 9, 6)
    return finish(sp)


def all_landmarks():
    return {
        "land/clock": clock(),
        "land/wreck": wreck(),
        "land/bargain": bargain(),
        "land/dial": dial(),
        "land/lighthouse": lighthouse(),
        "land/bell": bell(),
    }
