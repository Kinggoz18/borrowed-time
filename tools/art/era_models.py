"""Village / town / city sprites (medium grid, lot diamond 96x48), built with isorender like models.py.
Everything sits flush on the shared footing: no baked-in base slabs."""
import numpy as np
from isorender import *
from pixlib import hsh, INK
import terrain as T

BW, BH, BAX, BAY = 120, 136, 60, 130

PAVE = {"light": (186, 172, 146), "base": (160, 146, 120), "shade": (128, 116, 94), "dark": (88, 78, 62)}
CURB = {"light": (190, 188, 176), "base": (156, 154, 144), "shade": (118, 116, 108), "dark": (74, 72, 66)}


def _grass(sp, a0, b0, a1, b1, seed):
    """Grass under a flush piece: the same moss tones as the ground tile."""
    G = T.GRASS
    sp.fill([sp.P(a0, b1), sp.P(a1, b1), sp.P(a1, b0), sp.P(a0, b0)], lambda x, y: G[int(hsh(x // 2, y, seed) * 3) + 1 if hsh(x, y, seed + 1) > 0.15 else 0], edge=None)


def lamp(sp, a, b, h=30):
    sp.post(a, b, 0, h, 3, WOOD)
    x, y = sp.P(a, b, h)
    sp.rect(int(x) - 3, int(y) - 7, 7, 7, BRASS["dark"])
    sp.rect(int(x) - 2, int(y) - 6, 5, 5, (250, 222, 132))
    sp.rect(int(x) - 1, int(y) - 5, 3, 3, (255, 244, 190))
    sp.rect(int(x) - 4, int(y) - 8, 9, 1, BRASS["shade"])


def road_icon(look=0):
    """Build-menu icon and road showcase: a paved avenue running along the dial's hour-line, flush with the grass, kerb stones, a lamp, a signpost."""
    W, H, AX, AY = 112, 74, 56, 70
    sp = Sprite(W, H, AX, AY, seed=7 + look)
    _grass(sp, 0.0, 0.0, 1.0, 1.0, 3)
    lo, hi = 0.30, 0.70                                      # road band across b, running along a
    def pave(x, y):
        cx, cy = int(x) // 3, int(y) // 2
        r = hsh(cx, cy, 11 + look)
        c = PAVE["base"] if r > 0.25 else PAVE["shade"]
        if r > 0.82:
            c = PAVE["light"]
        if (int(x) + (int(y) // 2) * 2) % 6 == 0:
            c = PAVE["dark"]
        return c
    sp.fill([sp.P(0.0, hi), sp.P(1.0, hi), sp.P(1.0, lo), sp.P(0.0, lo)], pave, edge=None)
    # hour-line ticks down the middle
    for t in np.arange(0.08, 1.0, 0.16):
        x0, y0 = sp.P(t, 0.5); x1, y1 = sp.P(t + 0.07, 0.5)
        sp.line((x0, y0), (x1, y1), BRASS["base"])
    # kerb stones along both edges
    for b in (lo - 0.025, hi + 0.015):
        for t in np.arange(0.0, 1.0, 0.1):
            x0, y0 = sp.P(t, b); x1, y1 = sp.P(t + 0.07, b)
            sp.line((x0, y0), (x1, y1), CURB["light"] if int(t * 10) % 2 else CURB["base"])
    lamp(sp, 0.12, hi + 0.12, 26)
    # signpost: a plank pointing to the dial
    sp.post(0.82, lo - 0.14, 0, 20, 3, WOOD)
    x, y = sp.P(0.82, lo - 0.14, 18)
    sp.rect(int(x) - 1, int(y) - 7, 12, 6, PLANK["base"])
    sp.rect(int(x) - 1, int(y) - 7, 12, 1, PLANK["light"])
    sp.rect(int(x) + 11, int(y) - 6, 1, 4, PLANK["dark"])
    sp.finish()
    return sp.a, (AX, AY)


# ------------------------------------------------------------------------------------------------ Colony Workshop and Bank (no longer crates)
from iso2 import S2, WARM_LIGHT, GLASSB
from vil import hg
import models as M


def _sp(seed):
    return S2(M.BW, M.BH, M.BAX, M.BAY, seed)


def colony_workshop_l1():
    """Salvage forge: a canvas lean-to over a stone hearth with a tall chimney, an anvil on a stump, a bench and a ship's wheel on the back wall."""
    sp = _sp(31)
    P = sp.P
    sp.box(0.14, 0.14, 0.88, 0.22, 0, 30, "plank", TAR, salt=1)                     # back wall
    sp.box(0.14, 0.14, 0.22, 0.80, 0, 30, "plank", TAR, salt=2)                     # left wall
    sp.box(0.60, 0.30, 0.82, 0.54, 0, 15, "stone", STONE, salt=3)                   # hearth
    sp.box(0.64, 0.34, 0.78, 0.50, 15, 3, "stone", SLATE, salt=4)
    sp.line(P(0.66, 0.50, 6), P(0.76, 0.50, 6), (214, 112, 52), 1); sp.line(P(0.66, 0.50, 5), P(0.76, 0.50, 5), (246, 170, 76), 1)   # embers
    sp.chimney(0.66, 0.24, 18, 26, 0.12, STONE, pot=False)
    sp.cyl(0.40, 0.52, 0.09, 0, 8, "plank", WOOD, salt=5, top=True)                # stump
    sp.box(0.34, 0.47, 0.46, 0.57, 8, 4, "plank", IRON if False else TAR, salt=6)  # anvil
    sp.box(0.30, 0.50, 0.50, 0.54, 12, 2, "plank", TAR, salt=7)
    sp.box(0.26, 0.66, 0.54, 0.80, 0, 10, "hplank", PLANK, salt=8)                 # bench
    x, y = P(0.34, 0.22, 20)
    from models import ship_wheel
    ship_wheel(sp, int(x), int(y), 8)
    for a, b in ((0.14, 0.84), (0.88, 0.84), (0.88, 0.22)):
        sp.post(a, b, 0, 34, 4, WOOD)
    sp.face([P(0.08, 0.90, 31), P(0.94, 0.90, 31), P(0.94, 0.10, 40), P(0.08, 0.10, 40)], "cloth", CANVAS, "top", salt=9, uv=lambda x, y: (x, y))
    sp.line(P(0.08, 0.90, 31), P(0.94, 0.90, 31), CANVAS["dark"]); sp.line(P(0.94, 0.90, 31), P(0.94, 0.10, 40), CANVAS["shade"])
    sp.finish(); sp.shadow()
    return sp.a, {"chimney": list(P(0.72, 0.30, 46))}


def colony_workshop_l2():
    """Plank shed with a canvas gable, a wide open door, a ship's wheel and a brass gear on the end wall, a stone chimney."""
    sp = _sp(32)
    P = sp.P
    sp.box(0.14, 0.24, 0.86, 0.76, 0, 24, "plank", PLANK, salt=11)
    sp.opening("L", 0.28, 0, 0.22, 16, b1=0.76, door=True, frame=WOOD)
    sp.opening("L", 0.64, 8, 0.12, 9, b1=0.76, lit=True)
    sp.gable(0.08, 0.18, 0.92, 0.82, 24, 20, "cloth", CANVAS, ridge="a", salt=12, end_mat="plank", end_ramp=PLANK)
    sp.chimney(0.20, 0.30, 24, 20, 0.12, STONE, pot=True)
    x, y = P(0.86, 0.50, 14)
    from models import ship_wheel
    ship_wheel(sp, int(x) + 3, int(y) - 3, 9)
    sp.gear(int(x) - 2, int(y) + 12, 5, BRASS, teeth=8)
    sp.finish(); sp.shadow()
    return sp.a, {"chimney": list(P(0.26, 0.36, 48))}


def colony_bank_l1():
    """Counting hut: a small tarred plank hut under a canvas roof, a brass-banded chest at the door and a big hourglass sign on a post."""
    sp = _sp(33)
    P = sp.P
    sp.box(0.22, 0.28, 0.72, 0.74, 0, 22, "plank", TAR, salt=21)
    sp.opening("L", 0.34, 0, 0.14, 14, b1=0.74, door=True, frame=WOOD)
    sp.opening("L", 0.56, 8, 0.1, 8, b1=0.74, lit=True)
    sp.prism(0.16, 0.22, 0.78, 0.80, 22, 14, "a", "cloth", CANVAS, salt=22)
    sp.box(0.60, 0.80, 0.74, 0.90, 0, 7, "plank", PLANK, salt=23)                   # chest
    sp.line(P(0.60, 0.90, 4), P(0.74, 0.90, 4), BRASS["base"]); sp.line(P(0.74, 0.90, 4), P(0.74, 0.80, 4), BRASS["shade"])
    sp.post(0.84, 0.84, 0, 40, 3, WOOD)
    x, y = P(0.84, 0.84, 40)
    sp.rect(int(x) - 7, int(y) - 18, 14, 18, PLANK["base"]); sp.rect(int(x) - 7, int(y) - 18, 14, 1, PLANK["light"]); sp.rect(int(x) - 7, int(y) - 1, 14, 1, PLANK["dark"])
    hg(sp, int(x), int(y) - 3, 14, 8)
    sp.finish(); sp.shadow()
    return sp.a, {}


def colony_bank_l2():
    """Counting house: a longer plank house, a canvas gable, a gallows bracket with a hanging hourglass sign and a lantern."""
    sp = _sp(34)
    P = sp.P
    sp.box(0.14, 0.26, 0.82, 0.76, 0, 26, "plank", PLANK, salt=31)
    sp.line(P(0.14, 0.76, 13), P(0.82, 0.76, 13), WOOD["dark"])
    sp.opening("L", 0.22, 0, 0.14, 15, b1=0.76, door=True, frame=WOOD)
    for a in (0.46, 0.66): sp.opening("L", a, 9, 0.1, 9, b1=0.76, lit=a > 0.5)
    sp.gable(0.08, 0.20, 0.88, 0.82, 26, 16, "cloth", CANVAS, ridge="a", salt=32, end_mat="plank", end_ramp=PLANK)
    # gallows bracket with a hanging hourglass sign
    sp.post(0.90, 0.80, 0, 40, 3, WOOD)
    x, y = P(0.90, 0.80, 38)
    sp.line((x, y), (x - 22, y), WOOD["base"], 2); sp.line((x - 6, y + 6), (x, y), WOOD["shade"])
    sp.line((x - 17, y + 1), (x - 17, y + 5), ROPE["base"])
    sp.rect(int(x) - 24, int(y) + 5, 14, 16, PLANK["base"]); sp.rect(int(x) - 24, int(y) + 5, 14, 1, PLANK["light"])
    hg(sp, int(x) - 17, int(y) + 19, 12, 7)
    sp.finish(); sp.shadow()
    return sp.a, {}
