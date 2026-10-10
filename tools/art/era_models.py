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
