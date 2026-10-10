"""Adds the street / scenery / landmark sets to public/art (run after build_art.py and build_eras.py):

   python tools/art/build_layout.py            (env ART_OUT=/tmp/x writes there instead, for previews)

scenery          every era: dirt-track autotiles (16 masks), the colony plaza, trees, bushes
streets_<era>    village / town / city: paved street autotiles (16 masks x 2 variants), the era plaza, town and city lamp posts
land_town        Town Clock, Founders' Wreck, Hesper's First Bargain (shown from Town, kept in the City)
land_city        Great Dial, Lighthouse, Tide-Bell (City)
roofs_<era>      town / city: r1, r2 roof and wall colour variants of the common 1x1 looks (the layout mixes them per lot)
Run after build_art.py and build_eras.py (build_eras rewrites manifest.eras); PYTHONHASHSEED=0 keeps the models' seeds fixed.
Sets are lazy-loaded with their era (manifest.eras); a tiny set of frames, well inside the atlas budget."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from eralib import Frame, write_set, merge_manifest
import streets_art as SA
import landmarks_art as LA

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.environ.get("ART_OUT") or os.path.join(HERE, "..", "..", "public", "art"))


def crop(a, anchor):
    ys, xs = np.nonzero(a[..., 3])
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return a[y0:y1, x0:x1].copy(), (anchor[0] - x0, anchor[1] - y0)


def ground(frames, name, a):
    frames[name] = Frame(a, SA.ANCHOR[0], SA.ANCHOR[1])


def prop(frames, name, art):
    a, anc = art
    a, anc = crop(a, anc)
    frames[name] = Frame(a, anc[0], anc[1])


sets = {}
sc = {}
for m in range(16):
    ground(sc, f"st/track/{m}", SA.track_tile(m, 0))
ground(sc, "plaza/colony", SA.plaza_tile("colony"))
for v in range(4):
    prop(sc, f"sc/tree/{v}", SA.tree(v))
for v in range(3):
    prop(sc, f"sc/bush/{v}", SA.bush(v))
sets["scenery"] = sc
for era in ("village", "town", "city"):
    fr = {}
    for m in range(16):
        for v in range(2):
            ground(fr, f"st/{era}/{m}/{v}", SA.street_tile(era, m, v))
    ground(fr, f"plaza/{era}", SA.plaza_tile(era))
    if era != "village":
        prop(fr, f"sc/lamp/{era}", SA.lamp(era))
    sets[f"streets_{era}"] = fr
lm = LA.all_landmarks()
for name, grp in (("land_town", ("clock", "wreck", "bargain")), ("land_city", ("dial", "lighthouse", "bell"))):
    fr = {}
    for g in grp:
        prop(fr, f"land/{g}", lm[f"land/{g}"])
    sets[name] = fr

# Roof and wall variants (r1, r2) for the common 1x1 looks, so a block of the same building is not one colour: Town mixes blue slate and
# golden tile into the terracotta, the City mixes green copper and lighter brick into the sooted slate.
import civ
import iso2
from pixlib import grey_variant as _g  # noqa: F401  (kept for parity with build_eras)
TILE_OCHRE = {"light": (232, 202, 120), "base": (204, 164, 84), "shade": (150, 114, 56), "dark": (94, 66, 32)}
VARIANTS = {
    "town": [
        dict(roof=("slate", iso2.SLATE2), roof2=("tile", iso2.TILE)),
        dict(wall=("daub", iso2.DAUB), roof=("tile", TILE_OCHRE), roof2=("slate", iso2.SLATE2)),
    ],
    "city": [
        dict(roof=("tile", iso2.COPPER), roof2=("slate", iso2.SLATE2)),
        dict(wall=("brick", iso2.BRICK), roof=("slate", iso2.SLATE2), roof2=("tile", iso2.COPPER)),
    ],
}
HALLS = {"town": ["cottage", "workshop"], "city": ["cottage"]}   # the two most numerous looks keep the atlas inside its byte budget
for era, looks in (("town", 6), ("city", 7)):
    fr = {}
    saved = dict(civ.KITS[era])
    for v, over in enumerate(VARIANTS[era], start=1):
        civ.KITS[era].update(over)
        for typ in HALLS[era]:
            for st in range(looks):
                a, anc, info = civ.hall(era, typ, st, 1)
                a2, anchor2 = crop(a, anc)
                fr[f"b/{era}/{typ}/{st}/r{v}"] = Frame(a2, anchor2[0], anchor2[1])
        civ.KITS[era].clear()
        civ.KITS[era].update(saved)
    sets[f"roofs_{era}"] = fr

sizes = {name: write_set(OUT, name, frames, 64 if name.startswith("roofs") else 96) for name, frames in sets.items()}
import json
man = json.load(open(os.path.join(OUT, "manifest.json")))
eras = {e: list(v) for e, v in man["eras"].items()}
add = {"colony": ["scenery"], "village": ["scenery", "streets_village"], "town": ["scenery", "streets_town", "land_town", "roofs_town"], "city": ["scenery", "streets_city", "land_town", "land_city", "roofs_city"]}
for e, extra in add.items():
    eras[e] = [s for s in eras[e] if s not in sets] + extra
merge_manifest(OUT, list(sets), eras, {})
print(sizes)
