"""Builds the era atlases (village, town, city) into public/art/ and merges them into manifest.json.

   python tools/art/build_eras.py            (env ART_OUT=/tmp/x writes there instead, for previews)

Each era set holds that era's building looks (b/<era>/<type>/<look>, plus grey/ variants for the 1x1 frames), field sway frames,
ground tiles; a `<era>_big` set holds the 2x2 and 3x3 versions (b/<era>/<type>/<look>/f2, /f3) the layout uses when the claim fits.
Sets are lazy-loaded when the tier reaches the era (manifest.eras)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from eralib import Frame, write_set, merge_manifest
from pixlib import grey_variant
import era_models as EM
import vil, civ, fields
import era_ground as EG

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.environ.get("ART_OUT") or os.path.join(HERE, "..", "..", "public", "art"))

# the claim sizes per look, mirrored from src/core/rules.ts FOOT (a test keeps them in sync)
FOOT = {
    "field": [0, 0, 0, 0, 2, 2, 3], "workshop": [0, 0, 0, 0, 2, 2, 3], "tower": [0, 0, 0, 0, 0, 2, 2],
    "bank": [0, 0, 0, 0, 2, 2, 3], "lantern": [0, 0, 0, 0, 2, 2, 3], "mirror": [0, 0, 0, 0, 2, 2, 3],
    "trade": [0, 0, 0, 0, 2, 2, 3], "academy": [0, 0, 0, 0, 2, 2, 3], "hospital": [0, 0, 0, 0, 2, 2, 3],
    "exchange": [0, 0, 0, 0, 2, 2, 3], "harbour": [0, 0, 0, 0, 2, 2, 3], "observatory": [0, 0, 0, 0, 2, 2, 3],
}
ERAS = {
    "village": (4, ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade"]),
    "town": (6, ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade", "mirror", "academy", "hospital"]),
    "city": (7, ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade", "mirror", "academy", "hospital", "exchange", "harbour", "observatory"]),
}
HALL = {"cottage": "cottage", "workshop": "workshop", "lantern": "lantern", "trade": "trade", "academy": "academy", "hospital": "hospital", "exchange": "exchange", "harbour": "harbour", "bank": "bank"}


def model(era, typ, st, U):
    if era == "village":
        return {"cottage": vil.cottage, "workshop": vil.workshop, "tower": vil.tower, "bank": vil.bank, "lantern": vil.lantern_hall, "trade": vil.trade}[typ](st)
    if typ == "tower":
        return civ.tower(era, st, U)
    if typ == "mirror":
        return civ.mirror(era, st, U)
    if typ == "observatory":
        return civ.observatory(era, st, U)
    return civ.hall(era, HALL[typ], st, U)


def crop(a, anchor, anc):
    """trim to the opaque bounding box (the packer then wastes no space); anchors move with it"""
    ys, xs = np.nonzero(a[..., 3])
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    out = {k: (v[0] - x0, v[1] - y0) for k, v in (anc or {}).items()}
    return a[y0:y1, x0:x1].copy(), (anchor[0] - x0, anchor[1] - y0), out


def add(fr, name, a, anchor, anc=None, grey=True):
    if a.shape[0] > 40:                 # ground tiles keep their frame
        a, anchor, anc = crop(a, anchor, anc)
    info = {k: [round(float(v[0]), 2), round(float(v[1]), 2)] for k, v in (anc or {}).items()}
    fr[name] = Frame(a, anchor[0], anchor[1], info)
    if grey:
        fr["grey/" + name] = Frame(grey_variant(a, 0.55, 0.14), anchor[0], anchor[1])


def build_era(era):
    looks, types = ERAS[era]
    small, big = {}, {}
    for typ in types:
        for st in range(looks):
            if typ == "field":
                for fi in range(3):
                    a, anc = fields.field(era, st, fi, 1)
                    nm = f"b/{era}/field/{st}" + ("" if fi == 0 else f"/s{fi}")
                    add(small, nm, a, anc)
                f = FOOT["field"][st] if st < 7 else 0
                for U in range(2, f + 1):
                    for fi in range(3):
                        a, anc = fields.field(era, st, fi, U)
                        add(big, f"b/{era}/field/{st}/f{U}" + ("" if fi == 0 else f"/s{fi}"), a, anc, grey=False)
                continue
            a, anc, info = model(era, typ, st, 1)
            add(small, f"b/{era}/{typ}/{st}", a, anc, info)
            f = FOOT[typ][st] if typ in FOOT and st < 7 else 0
            for U in range(2, f + 1):
                a, anc, info = model(era, typ, st, U)
                add(big, f"b/{era}/{typ}/{st}/f{U}", a, anc, info, grey=False)
    for kind in ("grass", "lot", "road"):
        for v in range(3):
            g = EG.era_tile(era, kind, v)
            small[f"g/{era}/{kind}/{v}"] = Frame(g, __import__("terrain").GANCHOR[0], __import__("terrain").GANCHOR[1])
            if kind in ("lot", "road"):
                small[f"grey/g/{era}/{kind}/{v}"] = Frame(grey_variant(g), __import__("terrain").GANCHOR[0], __import__("terrain").GANCHOR[1])
    return small, big


sets = {}
anchors = {}
# soft grass/sand borders (blend.py): one small set every era loads, so the beach never shows the 1-cell zigzag
import blend as BL
import terrain as _T
blend_frames = {}
for own in ("g", "s"):
    for mask in range(1, 256):
        fr = BL.blend_frame(own, mask, BL.SIGMA)
        if (fr[..., 3] > 0).any():
            c, (ax, ay), _ = crop(fr, (_T.GANCHOR[0], _T.GANCHOR[1]), None)
            blend_frames[f"blend/{own}/{mask}"] = Frame(c, ax, ay)
sets["blend"] = blend_frames
a, anc = EM.road_icon()
eras_out = {}
for era in ("village", "town", "city"):
    small, big = build_era(era)
    small["ui/road"] = Frame(a, anc[0], anc[1])
    sets[era] = small
    eras_out[era] = ["shared", era, "blend"]
    if big:
        sets[era + "_big"] = big
        eras_out[era].insert(2, era + "_big")

sizes = {}
for name, frames in sets.items():
    for n, f in frames.items():
        if f.info:
            anchors[n] = f.info
    sizes[name] = write_set(OUT, name, frames, 128 if name.startswith(("town", "city")) else 96)
eras_out["colony"] = ["shared", "colony", "blend"]
merge_manifest(OUT, list(sets), eras_out, anchors)
tot = {sc: sum(s[sc] for s in sizes.values()) for sc in ("m", "l")}
print(sizes)
print("total PNG bytes", tot)
