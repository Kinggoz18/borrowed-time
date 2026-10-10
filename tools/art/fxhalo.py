"""Pixel-art lamplight: hard-pixel halos (three colour rings, Bayer-dithered falloff, no soft alpha) drawn additive at dusk and night
on lit windows, lantern eaves and Hesper's tent. Three sizes."""
import numpy as np
from pixlib import BAYER

CORE, MID, OUT = (255, 240, 184), (250, 200, 104), (226, 140, 60)


def halo(r):
    n = int(r * 2 + 3)
    a = np.zeros((n, n, 4), np.uint8)
    yy, xx = np.mgrid[0:n, 0:n]
    d = np.sqrt((xx - n / 2 + 0.5) ** 2 + ((yy - n / 2 + 0.5) * 1.4) ** 2) / r      # a little flattened: the iso view's circle
    bay = BAYER[yy % 4, xx % 4]
    for lo, hi, col, dense in ((0.0, 0.28, CORE, 1.0), (0.28, 0.62, MID, 0.7), (0.62, 1.0, OUT, 0.34)):
        fall = dense * (1 - (d - lo) / (hi - lo) * 0.45)
        m = (d >= lo) & (d < hi) & (bay < fall)
        a[m, :3] = col
        a[m, 3] = 255
    return a, n // 2
