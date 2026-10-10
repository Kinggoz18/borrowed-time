# Pixel-art pipeline

`python tools/art/build_art.py` then `python tools/art/build_eras.py` (the second merges the era sets into the manifest the first writes) (needs numpy, scipy, Pillow) writes `public/art/`:
`manifest.json` (scales, era sets, anchors, shore masks), `<m|l>/<set>.png|json` (PNG-8 atlases on one shared
palette, one page each, max 2048) and the tiling sea textures. `m` is the fine grid (High tier), `l` the chunky
grid (Low and Medium); one art pixel is 1/s world units, so the camera snaps to whole device pixels per art pixel.

Sources: `tools/art/src` (PoC cottage, tower, gull, smoke, flag, grass, foam sheets). People, boats, the gnomon, tent,
ring and gate come from the game's own puppets: `npm run dev`, then `node tools/art/dump.mjs .cache/art-dump colony 4 '^(p/|boat)'`
(the cache is git-ignored). Workshop, bank, field and palisade pieces are drawn by `models.py` / `isorender.py`.

New era (village, town, city): add the models, a set name in `build_art.py`, and list it under `eras` in the manifest;
`loadPixelArt(...).ensureEra(era)` lazy-loads it. Frames the pixel pages do not draw yet fall back to the procedural atlas.
