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

## Landmarks (cosmetic, no effect; placed by the player, DECISIONS #27)
They no longer appear on their own. From Town the player unlocks them in the Build sheet's Landmarks section and places each (free, one of each) on a free lot or a plaza tile, and can move it for free. Tap shows a plaque (name and one line). Art is lazy-loaded with the era (`land_town`, `land_city`).
- Town: The Town Clock, Hesper's First Bargain, The Founders' Wreck.
- City: The Great Dial, The Tide-Bell, The Lighthouse.
Their old fixed positions (street junctions and the shore) are gone; the lots, caps and costs never changed.

## Art pipeline
`python tools/art/build_art.py; python tools/art/build_eras.py; PYTHONHASHSEED=0 python tools/art/build_layout.py` (build_layout must run last: build_eras rewrites `manifest.eras`). It adds `scenery`, `streets_<era>`, `land_town`, `land_city`, `roofs_<era>` (roof and wall variants r1/r2 of cottages and workshops, so a block is not one colour).
