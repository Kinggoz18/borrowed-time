"""Builds the era atlases (village, town, city) into public/art/ and merges them into manifest.json.

   python tools/art/build_eras.py

Each era set holds that era's building looks (b/<era>/<type>/<look>, plus grey/ variants), set pieces and ground frames;
the shared set (people, boats, ambient fx, terrain) stays in build_art.py. Sets are lazy-loaded when the tier reaches the era."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from eralib import Frame, write_set, merge_manifest
import era_models as EM

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "art"))

sets = {"village": {}}
anchors = {}

a, anc = EM.road_icon()
sets["village"]["ui/road"] = Frame(a, anc[0], anc[1])

sizes = {}
for name, frames in sets.items():
    sizes[name] = write_set(OUT, name, frames)
merge_manifest(OUT, list(sets), {"village": ["shared", "village"]}, anchors)
print(sizes)
