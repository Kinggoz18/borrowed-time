"""Terrain per era: the shared moss ground stays the base; Town lays cobbles and trims the lawn, City paves everything with flagstone.
Patterns are diamond lattices (lines along the two iso axes) with periods that divide the lattice step (96, 48), so neighbouring tiles join seamlessly."""
import numpy as np
import terrain as T
from pixlib import hsh

COBBLE = [(150, 138, 120), (166, 152, 132), (134, 124, 110), (176, 164, 144)]
COBBLE_MORT = (92, 82, 70)
FLAG = [(168, 168, 164), (184, 184, 178), (150, 150, 148), (196, 196, 190)]
FLAG_MORT = (104, 104, 104)
ASPH = [(92, 94, 100), (82, 84, 92), (104, 106, 112), (72, 74, 82)]
ASPH_MORT = (50, 52, 60)


def lattice(a, pal, mort, cell, salt, only=None):
    """repaint opaque pixels with diamond pavers of `cell` px (along each iso diagonal)."""
    out = a.copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    u = xx + 2 * yy
    v = xx - 2 * yy
    iu, iv = u // cell, v // cell
    n = 96 // cell
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 0 or (only is not None and not only[y, x]):
                continue
            if u[y, x] % cell == 0 or v[y, x] % cell == 0:
                out[y, x, :3] = mort
            else:
                r = hsh(int(iu[y, x]) % n, int(iv[y, x]) % n, salt)
                out[y, x, :3] = pal[0] if r < 0.5 else pal[1] if r < 0.7 else pal[2] if r < 0.88 else pal[3]
    return out


def tint(a, mul, add=(0, 0, 0)):
    out = a.copy().astype(np.float32)
    m = a[..., 3] > 0
    out[m, :3] = np.clip(out[m, :3] * np.array(mul, np.float32) + np.array(add, np.float32), 0, 255)
    return out.astype(np.uint8)


def era_tile(era, kind, v):
    g = T.ground_tile(kind, v)
    if era == "village":
        return g if kind != "grass" else tint(g, (1.03, 1.0, 0.9))              # warmer, hay-dry moss
    h, w = g.shape[:2]
    if era == "town":
        if kind == "grass":
            return tint(g, (0.95, 1.06, 0.95), (0, 4, 0))                       # trimmed lawn
        if kind == "road":
            return lattice(g, COBBLE, COBBLE_MORT, 8, 70 + v)
        if kind == "lot":
            # lawn with a small cobbled apron in the middle
            yy, xx = np.mgrid[0:h, 0:w]
            c = (np.abs(xx - w / 2) / 20.0 + np.abs(yy - h / 2) / 10.0) < 1.0
            return lattice(tint(g, (0.95, 1.06, 0.95), (0, 4, 0)), COBBLE, COBBLE_MORT, 8, 80 + v, only=c)
    if era == "city":
        if kind == "grass":
            return tint(g, (0.86, 0.98, 0.9), (0, 0, 4))                        # clipped municipal lawn
        if kind == "road":
            return lattice(g, ASPH, ASPH_MORT, 12, 90 + v)
        if kind == "lot":
            return lattice(g, FLAG, FLAG_MORT, 12, 100 + v)
    return g
