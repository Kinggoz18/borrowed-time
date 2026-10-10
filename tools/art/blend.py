"""Soft grass/sand borders. The land is a grid of diamond cells, so a plain sand/grass boundary is a 1-cell zigzag (the 'sawtooth' of
the diagonal coastline). Each border cell gets an overlay cut from a Gaussian-smoothed kind raster of its 3x3 neighbourhood: convex tips are
rounded off, notches filled, the edge wobbles a little, and every pixel is still a hard pixel of the other kind's own ground tile.
Names: blend/<g|s>/<mask>  (own kind grass / sand; mask bit k = the cell at SHORE_CELLS[k] is the OTHER kind)."""
import numpy as np
from scipy import ndimage as ndi
import terrain as T
from pixlib import hsh

CELLS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]   # must match src/render/island/coast.ts SHORE_CELLS


SIGMA = 16.0


def diamond(h, w, cx, cy, rx=48.0, ry=24.0):
    yy, xx = np.mgrid[0:h, 0:w]
    return (np.abs(xx + 0.5 - cx) / rx + np.abs(yy + 0.5 - cy) / ry) <= 1.0


def blend_frame(own, mask, sigma=SIGMA):
    FW, FH = T.FW, T.FH
    CW, CH = FW * 5, FH * 5
    ox, oy = CW // 2, CH // 2 + 0
    ind = np.zeros((CH, CW), np.float32)
    for k, (di, dj) in enumerate(CELLS):
        if mask >> k & 1:
            cx, cy = ox + (di - dj) * 48, oy + (di + dj) * 24
            ind[diamond(CH, CW, cx, cy, 49.0, 24.5)] = 1.0
    f = ndi.gaussian_filter(ind, sigma)
    x0, y0 = ox - FW // 2, oy - FH // 2
    f = f[y0:y0 + FH, x0:x0 + FW]
    yy, xx = np.mgrid[0:FH, 0:FW]
    noise = np.array([[hsh(x // 2, y // 2, 17 + own.__len__()) for x in range(FW)] for y in range(FH)], np.float32)
    own_tile = T.ground_tile("grass" if own == "g" else "sand", 0)
    opp_tile = T.ground_tile("sand" if own == "g" else "grass", 1)
    show = (f > 0.5 + 0.16 * (noise - 0.5)) & (own_tile[..., 3] > 0)
    out = np.zeros_like(own_tile)
    out[show] = opp_tile[show]
    out[..., 3] = np.where(show, 255, 0)
    return out
