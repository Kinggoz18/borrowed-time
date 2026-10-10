"""Builds the shipped pixel-art atlases into public/art/ (see README.md).

   python tools/art/build_art.py            # needs numpy, pillow, scipy and a dump of the procedural frames (tools/art/dump.mjs)

Outputs  public/art/manifest.json
         public/art/<m|l>/shared.png|json   terrain, shore autotiles, ring + gate, people, boats, fx, ambient sprites (every era)
         public/art/<m|l>/colony.png|json   colony buildings (looks 1-2), gnomon, Hesper's tent
         public/art/<m|l>/sea_*.png         seamless sea tiles (own files: TilingSprite needs repeat wrapping)
m = medium/high (1 art px = 2/3 world unit), l = low (everything half size, i.e. 4/3 unit per px)."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixlib import *
import terrain as T
import models as M

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "art")
DUMP = os.path.join(ROOT, ".cache", "art-dump")
SCALE = {"m": 1.0, "l": 0.5}
S_UNITS = {"m": 1.5, "l": 0.75}                   # art px per world unit

JOBS = ["field", "clockworks", "trade", "watch", "raider", "hesper", "nell", "ada", "tobias", "noon"]
ANIMS = {"idle": 2, "walk": 4, "work": 2}
VIEWS = ["se", "sw", "ne", "nw"]
PEOPLE_F = 0.375                                   # dump is drawn at s=4, the atlas is s=1.5


class Frame:
    def __init__(self, a, ax, ay, info=None):
        self.a, self.ax, self.ay, self.info = a, ax, ay, info or {}


frames = {"shared": {}, "colony": {}}
manifest_info = {}


def add(setname, name, a, ax, ay, info=None):
    frames[setname][name] = Frame(a, ax, ay, info)


# ------------------------------------------------------------------------------------------------ terrain
KINDS = ["grass", "lot", "sand", "road", "plot"]
for kind in KINDS:
    for v in range(3):
        g = T.ground_tile(kind, v)
        add("shared", f"g/{kind}/{v}", g, T.GANCHOR[0], T.GANCHOR[1])
        if kind in ("lot", "plot", "road"):
            add("shared", f"grey/g/{kind}/{v}", grey_variant(g), T.GANCHOR[0], T.GANCHOR[1])
shore, shore_names, shore_cells = T.all_shore_frames()
for n, a in shore.items():
    add("shared", n, a, T.SANCHOR[0], T.SANCHOR[1])
manifest_info["shore"] = {"cells": shore_cells, "masks": {str(k): v for k, v in shore_names.items()}}

# ------------------------------------------------------------------------------------------------ ambient sprites (generated art, keyed)
def layer(name, scale=0.12):
    im = Image.open(f"{HERE}/src/{name}.png").convert("RGBA")
    a = hard(box_down(im, scale / 0.4))
    a, _ = trim(a)
    return a

for i in range(4):
    g = layer(f"gull_{i}", 0.12)
    if i == 2:                                      # gull_2 was drawn facing right; every frame faces LEFT (the game mirrors for right-flying birds)
        g = g[:, ::-1].copy()
    add("shared", f"fx/gull/{i}", g, g.shape[1] // 2, g.shape[0] // 2)
for i in range(4):
    c = layer(f"foam_{i}", 0.12)[:, ::-1].copy()    # wave crests curl towards the island side: all face LEFT, and roll left/up in game
    add("shared", f"fx/crest/{i}", c, c.shape[1] // 2, c.shape[0] // 2)
for i in range(5):
    sm = layer(f"smoke_{i}", 0.1)
    add("shared", f"fx/smoke/{i}", sm, sm.shape[1] // 2, sm.shape[0] // 2)
for i in range(4):
    fl = layer(f"flag_{i}", 0.1)
    add("shared", f"fx/flag/{i}", fl, 1, 1)
for gi in range(4):
    g = layer(f"grass_{gi}", 0.1)
    for si, dx in enumerate([-1, 0, 1]):
        h, w = g.shape[:2]
        pad = 2
        out = np.zeros((h, w + 2 * pad, 4), np.uint8)
        for y in range(h):
            hf = ((h - 1 - y) / max(h - 1, 1)) ** 1.4
            sh = int(round(dx * hf * 1.5))
            out[y, pad + sh: pad + sh + w] = g[y]
        add("shared", f"fx/grass/{gi}/{si}", out, out.shape[1] // 2, out.shape[0] - 1)
for i, cs in enumerate(T.cloud_shadows()):
    add("shared", f"fx/cloud/{i}", cs, 0, 0)

# pixel fx (procedural)
def px_fx():
    spark = np.zeros((9, 9, 4), np.uint8)
    for k in range(4):
        spark[4 - k:5 + k, 4] = (255, 232, 140, 255) if k < 3 else (255, 250, 210, 255)
        spark[4, 4 - k:5 + k] = (255, 232, 140, 255)
    spark[4, 4] = (255, 255, 255, 255)
    add("shared", "fx/spark", spark, 4, 4)
    fire = np.zeros((16, 12, 4), np.uint8)
    for y in range(16):
        w = int(5.5 * np.sin(np.pi * (y + 2) / 18) ) + (1 if y > 5 else 0)
        for x in range(6 - w, 6 + w):
            t = abs(x + .5 - 6) / max(w, 1)
            fire[y, x] = (250, 200, 80, 255) if t < .45 and y > 5 else (232, 120, 52, 255) if t < .85 else (150, 60, 36, 255)
    add("shared", "fx/fire", fire, 6, 15)
    dust = np.zeros((14, 18, 4), np.uint8)
    yy, xx = np.mgrid[0:14, 0:18]
    for (cx, cy, r) in ((5, 8, 5), (11, 8, 5), (8, 5, 5)):
        m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
        dust[m] = (216, 204, 170, 255)
    dust[(dust[..., 3] > 0) & ((xx + yy) % 5 == 0)] = (190, 178, 146, 255)
    add("shared", "fx/dust", dust, 9, 7)
px_fx()

# ------------------------------------------------------------------------------------------------ people and boats (pixelized from the approved puppet drawings, so each keeps its in-game look)
meta_path = os.path.join(DUMP, "meta.json")
if not os.path.exists(meta_path):
    sys.exit("run: node tools/art/dump.mjs .cache/art-dump colony 4 '^(p/|boat)'   (with `npm run dev` running)")
dm = json.load(open(meta_path))

def pixelize_dump(name, f=PEOPLE_F):
    im = Image.open(os.path.join(DUMP, dm[name]["file"])).convert("RGBA")
    a = hard(box_down(im, f), 110)
    return a, dm[name]

for job in JOBS:
    for anim, n in ANIMS.items():
        for v in ("se", "ne"):
            for fi in range(n):
                a, d = pixelize_dump(f"p/{job}/{anim}/{v}/{fi}")
                ax, ay = round(d["ax"] * 1.5), round(d["ay"] * 1.5)
                add("shared", f"p/{job}/{anim}/{v}/{fi}", a, ax, ay)
                flipv = "sw" if v == "se" else "nw"
                add("shared", f"p/{job}/{anim}/{flipv}/{fi}", a[:, ::-1].copy(), a.shape[1] - ax, ay)
for name in ("boat", "boat/beached"):
    a, d = pixelize_dump(name)
    add("shared", name, a, round(d["ax"] * 1.5), round(d["ay"] * 1.5))

# ------------------------------------------------------------------------------------------------ gnomon, tent, ring, gate
a, info = M.gnomon(); add("colony", "gnomon", a, M.BAX, M.BAY, info)
a, anc, info = M.tent(); add("colony", "tent", a, anc[0], anc[1], info)
for st in range(4):
    for piece in ("segA", "segB", "post"):
        add("shared", f"ring/{st}/{piece}", M.ring_piece(st, piece), M.RAX, M.RAY)
    for along in (True, False):
        for shut in (False, True):
            add("shared", f"gate/{st}/{'A' if along else 'B'}/{1 if shut else 0}", M.gate_piece(st, along, shut), M.RAX, M.RAY)

# ------------------------------------------------------------------------------------------------ colony buildings
BUILD = {
    ("cottage", 0): M.cottage_l1, ("cottage", 1): M.cottage_l2,
    ("tower", 0): M.tower_l1, ("tower", 1): M.tower_l2,
    ("workshop", 0): M.workshop_l1, ("workshop", 1): M.workshop_l2,
    ("bank", 0): M.bank_l1, ("bank", 1): M.bank_l2,
}
for (typ, st), fn in BUILD.items():
    a, info = fn()
    nm = f"b/colony/{typ}/{st}"
    add("colony", nm, a, M.BAX, M.BAY, info)
    add("colony", f"grey/{nm}", grey_variant(a, 0.55, 0.14), M.BAX, M.BAY)
for st in range(2):
    fs, anc = M.field_frames(st)
    for fi, a in enumerate(fs):
        nm = f"b/colony/field/{st}" + ("" if fi == 0 else f"/s{fi}")
        add("colony", nm, a, anc[0], anc[1])
        add("colony", f"grey/{nm}", grey_variant(a, 0.55, 0.14), anc[0], anc[1])

# ------------------------------------------------------------------------------------------------ palette, scale, pack
def sample_pixels(group, n_per=400):
    rs = np.random.RandomState(4)
    out = []
    for fr in group:
        p = fr.a[fr.a[..., 3] > 0][:, :3]
        if len(p):
            out.append(p[rs.choice(len(p), min(len(p), n_per), replace=False)])
    return np.concatenate(out)

def mkpal(px, n):
    sw = int(np.ceil(np.sqrt(len(px))))
    canvas = np.zeros((sw * sw, 3), np.uint8)
    canvas[:len(px)] = px
    q = Image.fromarray(canvas.reshape(sw, sw, 3)).quantize(colors=n, method=Image.MEDIANCUT, dither=Image.NONE)
    return np.array(q.getpalette()[: n * 3], np.uint8).reshape(-1, 3)

colony = list(frames["colony"].values())
shared = list(frames["shared"].values())
b_px = sample_pixels([f for f in colony if not f.info.get("x")], 900)
terr = [f for n, f in frames["shared"].items() if n.startswith(("g/", "shore/", "grey/g/"))]
other = [f for n, f in frames["shared"].items() if not n.startswith(("g/", "shore/", "grey/g/"))]
pal = np.concatenate([
    mkpal(b_px, 96), mkpal(sample_pixels(terr, 600), 64), mkpal(sample_pixels(other, 500), 80),
    np.array([INK, (255, 255, 255), (28, 36, 22)], np.uint8)])
pal = np.unique(pal, axis=0)[:255]
print("palette", len(pal))

def snap(a):
    out = a.copy()
    m = a[..., 3] > 0
    px = a[m][:, :3].astype(np.int32)
    d = ((px[:, None, :] - pal[None].astype(np.int32)) ** 2).sum(-1)
    out[m, :3] = pal[d.argmin(1)]
    return out

def pack(fr_dict, scale, maxw=2048):
    items = []
    for name, f in fr_dict.items():
        a, ax, ay = f.a, f.ax, f.ay
        if scale != 1.0:
            a = hard(box_down(Image.fromarray(a, "RGBA"), scale), 100)
            ax, ay = ax * scale, ay * scale
        items.append((name, snap(a), ax, ay, f))
    items.sort(key=lambda t: (-t[1].shape[0], -t[1].shape[1], t[0]))
    pad = 1
    x = y = rh = 0
    place = {}
    for name, a, ax, ay, f in items:
        h, w = a.shape[:2]
        if x + w + pad > maxw:
            x = 0; y += rh + pad; rh = 0
        place[name] = (x, y)
        x += w + pad
        rh = max(rh, h)
    H = y + rh + pad
    atlas = np.zeros((H, maxw, 4), np.uint8)
    meta = {}
    for name, a, ax, ay, f in items:
        px_, py_ = place[name]
        h, w = a.shape[:2]
        atlas[py_:py_ + h, px_:px_ + w] = a
        entry = [px_, py_, w, h, round(float(ax), 2), round(float(ay), 2)]
        meta[name] = entry
    return atlas, meta

def save_png8(a, path):
    h, w = a.shape[:2]
    idx = np.zeros((h, w), np.uint8)
    lut = {tuple(c): i + 1 for i, c in enumerate(pal)}
    m = a[..., 3] > 0
    px = a[m][:, :3]
    keys = (px[:, 0].astype(np.int32) << 16) | (px[:, 1].astype(np.int32) << 8) | px[:, 2]
    pk = (pal[:, 0].astype(np.int32) << 16) | (pal[:, 1].astype(np.int32) << 8) | pal[:, 2]
    order = np.argsort(pk)
    pos = np.searchsorted(pk[order], keys)
    idx[m] = order[pos] + 1
    im = Image.fromarray(idx, "P")
    full = np.zeros((256, 3), np.uint8)
    full[1:len(pal) + 1] = pal
    im.putpalette(full.ravel().tolist())
    im.save(path, transparency=0, optimize=True)

os.makedirs(OUT, exist_ok=True)
sizes = {}
for rk, sc in SCALE.items():
    d = os.path.join(OUT, rk)
    os.makedirs(d, exist_ok=True)
    for setname in ("shared", "colony"):
        atlas, meta = pack(frames[setname], sc)
        save_png8(atlas, os.path.join(d, f"{setname}.png"))
        json.dump({"w": atlas.shape[1], "h": atlas.shape[0], "frames": meta}, open(os.path.join(d, f"{setname}.json"), "w"), separators=(",", ":"))
        sizes[f"{rk}/{setname}"] = os.path.getsize(os.path.join(d, f"{setname}.png"))
    # sea tiles (tileable, own files)
    for i, t in enumerate(T.sea_tiles(False)):
        tt = t if sc == 1.0 else snap(hard(box_down(Image.fromarray(t, "RGBA"), sc), 100))
        save_png8(snap(tt), os.path.join(d, f"sea_{i}.png"))
    for i, t in enumerate(T.sea_tiles(True)):
        tt = t if sc == 1.0 else snap(hard(box_down(Image.fromarray(t, "RGBA"), sc), 100))
        save_png8(snap(tt), os.path.join(d, f"rough_{i}.png"))
    g = T.water_glints()
    gg = g if sc == 1.0 else hard(box_down(Image.fromarray(g, "RGBA"), sc), 100)
    save_png8(snap(gg), os.path.join(d, "glint.png"))

anchors = {}
for setname in ("shared", "colony"):
    for name, f in frames[setname].items():
        if f.info:
            anchors[name] = f.info
manifest = {
    "version": 1,
    "scales": {"m": {"s": S_UNITS["m"]}, "l": {"s": S_UNITS["l"]}},
    "sets": {"shared": ["shared"], "colony": ["colony"]},
    "eras": {"colony": ["shared", "colony"], "village": ["shared"]},
    "sea": {"tile": T.SEA_T, "calm": 4, "rough": 4},
    "anchors": anchors,
    **manifest_info,
}
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), separators=(",", ":"))
print(sizes)
