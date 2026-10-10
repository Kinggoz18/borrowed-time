"""Shared helpers for the pixel-art pipeline (numpy + Pillow + scipy). Everything is deterministic."""
import numpy as np
from PIL import Image

# Medium/High scale: 1 art px = 2/3 world unit. The 64x32-unit lot diamond is 96x48 art px. Low is the same art at half size.
LOT_W, LOT_H = 96, 48
STEP_X, STEP_Y = LOT_W // 2, LOT_H // 2          # neighbour cell offset (48, 24)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
INK = (61, 52, 40)


def hsh(*v):
    h = 2166136261
    for x in v:
        h = ((h ^ (int(x) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h / 4294967296.0


def bayer(x, y):
    return BAYER[y % 4, x % 4]


def box_down(im, f):
    """Premultiplied box downscale of an RGBA PIL image by factor f (transparent pixels never bleed colour)."""
    w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
    a = np.array(im).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pm = np.concatenate([a[..., :3] * al, a[..., 3:4]], -1)
    chans = [np.array(Image.fromarray(pm[..., i], "F").resize((w, h), Image.BOX)) for i in range(4)]
    pm = np.stack(chans, -1)
    A = np.clip(pm[..., 3:4], 0, 255)
    rgb = np.where(A > 1, pm[..., :3] / np.maximum(A / 255.0, 1e-3), 0)
    return np.clip(np.concatenate([rgb, A], -1), 0, 255).astype(np.uint8)


def hard(a, thr=128):
    a = a.copy()
    m = a[..., 3] >= thr
    a[..., 3] = np.where(m, 255, 0)
    a[~m, :3] = 0
    return a


def trim(a, pad=0):
    ys, xs = np.nonzero(a[..., 3])
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (xs.min(), ys.min())


def diamond_mask(w=LOT_W, h=LOT_H + 2, cx=None, cy=None):
    """Pixel-centre membership of the lot diamond (never ties, so neighbouring tiles partition the plane)."""
    cx = w / 2 if cx is None else cx
    cy = h / 2 if cy is None else cy
    yy, xx = np.mgrid[0:h, 0:w]
    return (np.abs(xx + 0.5 - cx) / (LOT_W / 2) + np.abs(yy + 0.5 - cy) / (LOT_H / 2)) < 1.0


def grey_variant(a, amount=0.85, hatch=0.18):
    """Grey land (ART_BIBLE.md 4): desaturate, a touch cool, a 45 degree ink hatch. Keeps alpha."""
    out = a.copy().astype(np.float32)
    rgb = out[..., :3]
    y = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    rgb = rgb + (y[..., None] - rgb) * amount
    rgb[..., 0] -= 6 * amount
    rgb[..., 1] -= 1 * amount
    rgb[..., 2] += 8 * amount
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    line = ((xx + yy) % 6) == 0
    ink = np.array(INK, np.float32)
    rgb[line] = rgb[line] * (1 - hatch * 1.6) + ink * (hatch * 1.6)
    out[..., :3] = np.clip(rgb, 0, 255)
    out[a[..., 3] == 0, :3] = 0
    return out.astype(np.uint8)


def outline(a, color=INK, inner=False):
    """1 px outer outline around the alpha silhouette (4-neighbour), added into transparent pixels."""
    from scipy import ndimage as ndi
    m = a[..., 3] > 0
    ring = ndi.binary_dilation(m, structure=ndi.generate_binary_structure(2, 1)) & ~m
    o = a.copy()
    o[ring] = (*color, 255)
    return o


def pad_to(a, pad):
    return np.pad(a, ((pad, pad), (pad, pad), (0, 0)))


def to_img(a):
    return Image.fromarray(a, "RGBA")
