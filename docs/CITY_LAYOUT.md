# City layout: one island, city blocks, streets, landmarks

Layout and art only. No rule, cost, cap or sim-gate input changed (the gates report is identical to the previous build).

## The island is fixed
- `ISLAND_R = 15` in `src/render/island/layout.ts`: the coast is cut once for the final City (blocks and ring reach physical radius 14) with a margin of meadow, then sand. It is the same at every tier, so the coastline, sea, camera bounds and `fitBounds` never change at tier-up.
- Only the ring (palisade, the claimed ground) grows. Unclaimed land is open meadow with woods (`greens.ts`, per-cell hash, so it is stable) that the ring clears as it grows over it. Hesper's tent follows the ring edge.
- Camera: the default framing is the ring fit at the current tier; on tier-up the camera eases out to the new ring (`view.fit(true, true)`) instead of cutting. The whole island is the far overview, always.
- Saves are untouched (lot keys are the same logical `i,j`).

## City blocks (`src/core/streets.ts`, pure)
- The lots stay the rules' lots. For drawing, every three lots form a block and a street runs between neighbouring blocks: logical `c` is drawn at `phys(c) = c + floor((c+1)/3)`. Streets run on every fourth physical line (P = 2 mod 4). The gnomon's block is -1..1.
- Streets exist at every tier (they only gain cells as the grid grows), joined by 16-mask autotiles (straight, T, cross, ends) so the network is connected and meets the gate on the avenue (`J = 2`).
- Footprints (2x2, 3x3) stay inside one block (`claims` in `engine.ts` checks `blockOf`). That is the only engine line touched; the sim gates are identical.
- Era surfaces: colony and unpaved village = dirt track; after Roads: village cobbles, town paved with kerb and brass hour ticks, city asphalt with flagstone pavement. Plazas (four corners round the gnomon, plus each landmark junction) are paved with an hour ring.

## Landmarks (`landmarks.ts`, cosmetic, no effect)
Appear on their own by tier, lazy-loaded with the era, never in the Build sheet. Tap shows a plaque (name and one line).
- Town: The Town Clock (-6,-6), Hesper's First Bargain (6,2), The Founders' Wreck (west shore).
- City: The Great Dial (-2,-2), The Tide-Bell (-6,2), The Lighthouse (north shore).

## Art pipeline
`python tools/art/build_art.py; python tools/art/build_eras.py; PYTHONHASHSEED=0 python tools/art/build_layout.py` (build_layout must run last: build_eras rewrites `manifest.eras`). It adds `scenery`, `streets_<era>`, `land_town`, `land_city`, `roofs_<era>` (roof and wall variants r1/r2 of cottages and workshops, so a block is not one colour).
