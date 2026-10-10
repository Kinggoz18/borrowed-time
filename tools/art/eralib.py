"""Packing helpers for the era sets (village, town, city): each set gets its own quantised palette
(PNG-8, one page, max 2048 wide), written for the medium (m) and low (l) art grids, and merged into
public/art/manifest.json. Deterministic."""
import json, os
import numpy as np
from PIL import Image
from pixlib import box_down, hard, INK

SCALE = {"m": 1.0, "l": 0.5}


class Frame:
    def __init__(self, a, ax, ay, info=None):
        self.a, self.ax, self.ay, self.info = a, ax, ay, info or {}


def palette(frames, n=96):
    px = []
    rs = np.random.RandomState(4)
    for f in frames:
        p = f.a[f.a[..., 3] > 0][:, :3]
        if len(p):
            px.append(p[rs.choice(len(p), min(len(p), 700), replace=False)])
    px = np.concatenate(px + [np.array([INK, (255, 255, 255)], np.uint8)])
    sw = int(np.ceil(np.sqrt(len(px))))
    canvas = np.zeros((sw * sw, 3), np.uint8)
    canvas[:len(px)] = px
    q = Image.fromarray(canvas.reshape(sw, sw, 3)).quantize(colors=n, method=Image.MEDIANCUT, dither=Image.NONE)
    return np.unique(np.array(q.getpalette()[: n * 3], np.uint8).reshape(-1, 3), axis=0)[:255]


def snap(a, pal):
    out = a.copy()
    m = a[..., 3] > 0
    px = a[m][:, :3].astype(np.int32)
    d = ((px[:, None, :] - pal[None].astype(np.int32)) ** 2).sum(-1)
    out[m, :3] = pal[d.argmin(1)]
    return out


def pack(frames, scale, pal, maxw=2048):
    items = []
    for name, f in frames.items():
        a, ax, ay = f.a, f.ax, f.ay
        if scale != 1.0:
            a = hard(box_down(Image.fromarray(a, "RGBA"), scale), 100)
            ax, ay = ax * scale, ay * scale
        items.append((name, snap(a, pal), ax, ay))
    items.sort(key=lambda t: (-t[1].shape[0], -t[1].shape[1], t[0]))
    pad = 1
    x = y = rh = 0
    place = {}
    for name, a, ax, ay in items:
        h, w = a.shape[:2]
        if x + w + pad > maxw:
            x = 0; y += rh + pad; rh = 0
        place[name] = (x, y)
        x += w + pad
        rh = max(rh, h)
    atlas = np.zeros((y + rh + pad, maxw, 4), np.uint8)
    meta = {}
    for name, a, ax, ay in items:
        px_, py_ = place[name]
        h, w = a.shape[:2]
        atlas[py_:py_ + h, px_:px_ + w] = a
        meta[name] = [px_, py_, w, h, round(float(ax), 2), round(float(ay), 2)]
    return atlas, meta


def save_png8(a, pal, path):
    h, w = a.shape[:2]
    idx = np.zeros((h, w), np.uint8)
    m = a[..., 3] > 0
    px = a[m][:, :3]
    keys = (px[:, 0].astype(np.int32) << 16) | (px[:, 1].astype(np.int32) << 8) | px[:, 2]
    pk = (pal[:, 0].astype(np.int32) << 16) | (pal[:, 1].astype(np.int32) << 8) | pal[:, 2]
    order = np.argsort(pk)
    idx[m] = order[np.searchsorted(pk[order], keys)] + 1
    im = Image.fromarray(idx, "P")
    full = np.zeros((256, 3), np.uint8)
    full[1:len(pal) + 1] = pal
    im.putpalette(full.ravel().tolist())
    im.save(path, transparency=0, optimize=True)


def write_set(out_root, setname, frames, n_colors=96):
    """Writes <out_root>/<m|l>/<set>.png|json; returns {scale: png bytes}."""
    pal = palette(list(frames.values()), n_colors)
    sizes = {}
    for rk, sc in SCALE.items():
        d = os.path.join(out_root, rk)
        os.makedirs(d, exist_ok=True)
        atlas, meta = pack(frames, sc, pal)
        save_png8(atlas, pal, os.path.join(d, f"{setname}.png"))
        json.dump({"w": atlas.shape[1], "h": atlas.shape[0], "frames": meta}, open(os.path.join(d, f"{setname}.json"), "w"), separators=(",", ":"))
        sizes[rk] = os.path.getsize(os.path.join(d, f"{setname}.png"))
    return sizes


def merge_manifest(out_root, sets, eras, anchors):
    p = os.path.join(out_root, "manifest.json")
    m = json.load(open(p))
    m["sets"].update({s: [s] for s in sets})
    m["eras"].update(eras)
    m["anchors"].update(anchors)
    json.dump(m, open(p, "w"), separators=(",", ":"))
