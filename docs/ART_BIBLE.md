# Borrowed Time: art bible (v2, Village first)

Style **D**: option B's chunky shapes and strong silhouettes, drawn with option C's warm brown ink and paper grain.
- **References (not committed):** `bt-art/option-d-reference.jpg` (style) and `bt-art/village-sheet-v2.png` (Village mood).
- **Sources:**
  - `FINAL_PLAN_BT.md` §2, §5, §11;
  - `DESIGN_V2.md`;
  - `LORE.md`;
  - the prototype: `INK`, the 64×32 tile, the static grain.
- All numbers are starting targets. The decisions are recorded in §0.

## 0. Decisions (Chigozie, Oct 9 2026)
| # | Decision | Where |
|---|---|---|
| D1 | **Palette:** the Colony colours (sea-salt teal, driftwood, sailcloth, tar black), plus ink and paper, are the **constant** brand and world colours in every era. Each era adds only a **material** palette on top (Village: wheat gold, moss green, ochre, smoke white). | §4 |
| D2 | **Looks:** every era has its **own 7-look column per building type**. The `DESIGN_V2.md` table is the era-agnostic master (gameplay and footprint). Village is written in full; Colony, Town and City are stubbed. Looks above an era's level cap are marked as not reached. | §9 |
| D3 | **Lighting:** light is **baked into the painted art**. The shipped baseline has no normal maps. Dynamic 2D lighting is an optional high-tier extra, only after it passes the Phase 0 gate as a separate pass. The plan's §5 gate notes are updated to match. | §5, plan §5 |
| D4 | **Colour-blind safety:** debt and safe states always carry an **icon and a word**. Grey land is **faded colour plus a hatch**. Debt and safe colours are at least **25 L\*** apart. | §4 |
| D5 | **Gold and green clash:** materials are capped below the UI colours, using the exact saturation and lightness ceilings in §4. | §4 |
| D6 | **Hesper's tent** is the one deliberate exception: a material in a UI meaning colour. | §4 |

## 1. Pillars
1. **A ledger someone drew by hand:** ink line, flat gouache fills, paper underneath. Nothing glossy, nothing rendered.
2. **Readable at thumb size:** every building is identifiable by silhouette alone at fit zoom. Detail is a bonus for zooming in.
3. **Colour is borrowed:** saturation is the island's wealth. Debt, dusk and grey land take it away, and repaying gives it back. Nothing else uses desaturation.
4. **Restraint:** fewer, bigger shapes, one accent per building, and empty ground is allowed.
5. **Time moves, the stage doesn't:** light, weather, shadow and the flood are code. The art is calm, neutral-lit pieces.

## 2. Outline rules
- **Colour:** ink `#3D3428` (prototype `INK`) for every outer silhouette. Interior lines use the darkest shade of the local material. Never use `#000`.
- **Two weights only:** outer and interior. Authored on the 128×64 shipped tile (1 source px = 1 device px at zoom 1, DPR 2):

| View | Zoom | Outer line on screen | Interior line | Rule |
|---|---|---|---|---|
| Close (tap-zoom) | 1.0–1.4 | 3–4 px | 1.5–2 px | Full detail |
| Village fit | 0.55 | ~1.7 px | ~0.8 px | Interior lines may vanish, the silhouette must not |
| Town fit | 0.44 | ~1.3 px | — | Silhouette and roof colour only |
| City fit | 0.33 | ~1 px | — | Skyline read |

- **Source line weight:** outer line is 3 px on the high-tier atlas. The **low tier is a separate export**: a 2 px outer line on a 64×32 tile. Never downscale the high tier for it.
- **Brush-pen line:** ±0.5 px wobble, rounded ends, 1 px corner overshoot. No perfectly even vector strokes.
- **Characters and props:** the same ink and line weight. No rim or glow to "pop".
- **UI:** strokes use the same ink.

## 3. Shape language
- **Chunky over fussy:** roofs are 40–50% of a building's height, walls short and thick, doors about 1/3 of the wall height.
- **Shape per meaning:**
  - homes are triangles;
  - work is wide rectangles;
  - defence is tall verticals;
  - debt and time are circles (Hourglass, dial, Hesper's cone, lanterns).
- **One deliberate flaw per building:** a 1–3° lean or a sagging ridge. No jitter everywhere.
- **Silhouette gate:** every look, filled solid ink at 32 px wide, is identifiable and different from its neighbouring looks. Run it on the contact sheet at phone size (plan §11). Within one type, **each look must change the outline**, not only material or colour (see §8).
- **Plinths:** uniform per era (a fieldstone rim in Village), so the lot grid reads.

## 4. Palette
Colour ceilings use **HSV saturation (S)** and **CIE L\*** (lightness).

**Constants: every era, never re-skinned (D1)**

| Name | Hex | S / L\* | Use |
|---|---|---|---|
| Ink | `#3D3428` | 34 / 22 | Outlines, UI strokes, text on paper |
| Ink dim | `#7A6A55` | 30 / 46 | Secondary text, interior lines on light materials |
| Paper | `#EFE6D2` | 12 / 92 | UI panels, behind sheets |
| Sea-salt teal | `#5E9A98` · deep `#3F7473` · foam `#E4ECE3` | 38 / 60 | Sea, brand accent. Code tints it by time of day |
| Driftwood | `#8C7B68` · shade `#5F5244` | 25 / 53 | Wreck timber, jetty, gnomon fixings, UI frame wood |
| Sailcloth | `#E8DCC4` · shade `#C9B99A` | 15 / 88 | Canvas, panels, Hesper's tent ground stripe |
| Tar black | `#2A2420` | 23 / 15 | Hulls, the Late, deepest shadow (sparingly) |
| Gnomon stone | `#A39A8A` · shade `#7B7366` | 15 / 64 | The gnomon and dial ring |

**UI meaning colours: signals only, never materials (D4, D5)**

| Name | Hex | S / L\* | Meaning | Always paired with |
|---|---|---|---|---|
| Debt terracotta | `#A4532F` | 71 / 45 | Owed, interest, seizure | Cracked-hourglass icon + the word "owed" / "debt" |
| Safe green | `#82C155` | 56 / 72 | Repaid, kept, calm sea | Wax-seal tick icon + the word "kept" / "safe" |
| Action gold | `#D9A441` | 70 / 71 | The one tappable action on screen | Ink outline + a raised button with a 3 px lip |

**Colour-blind rules (D4):**
- **Debt vs safe:** **ΔL\* ≥ 25** (45 vs 72 = 27). Under deuteranopia they become dark olive vs light yellow-olive, so they separate by lightness, not hue. **Neither ever appears without its icon and word.**
- **Safe green vs action gold:** they converge under deuteranopia. Safe green is **never a button fill**. It appears only on icons, badges and text. Gold is only a raised button.
- **Grey land:** **faded colour plus a hatch**. It never relies on hue (spec below).
- **Test:** every screen passes a deuteranopia, protanopia and tritanopia simulation, plus a pure greyscale screenshot.

**Ceilings: materials vs UI (D5)**

| Class | Saturation (HSV S) | Lightness (L\*) | Notes |
|---|---|---|---|
| UI meaning colours | **≥ 55** | debt 42–48 · safe 70–75 · gold 68–74 | Only in UI and world signals |
| Era materials (all eras) | **≤ 45** | lit step **≤ 82** | Base and shade steps stay ≥ 10 S below the nearest UI colour of a similar hue |
| Materials in the gold hue band (30–50°) | **≤ 45** (25+ below action gold's 70) | ≤ 82 | Keeps wheat, thatch and brass from reading as a button |
| Materials in the green band (60–130°) | **≤ 42** | ≤ 70 | Keeps moss from reading as "safe" |
| Neutrals (smoke, sailcloth, paper, stone) | ≤ 15 | ≤ 92 | |
| Exceptions | Hesper's stripes `#B8633F` (S 65), the blue door (S 45) | | D6 and the Village signature only |

**Village materials: Hearth & Harvest, all within the ceilings**

| Material | Base | Shade | Light |
|---|---|---|---|
| Thatch | `#A78C5C` | `#776441` | `#CFB172` |
| Wheat | `#C0A369` | `#8C784D` | `#E2C67E` |
| Moss / grass | `#7E8F55` | `#5C6B3D` | `#9DAA6E` |
| Ochre daub | `#BD9D68` | `#8F754F` | `#DDB879` |
| Wattle / oak | `#72583F` | `#4F3C2C` | `#987554` |
| Fieldstone | `#A8A090` | `#7D7668` | `#C8C1B1` |
| Hearth smoke | `#ECE6DA` | — | — |
| **Blue door** (signature) | `#4E6F8E` | `#38526B` | — |

- **The blue door** comes from the lore beat "Someone painted a door blue". It appears on cottage look 3 and up, and **nowhere else**: no blue clothes, roofs or props. It is the era's only cool accent besides the constant sea teal.
- **Hesper's tent (D6):** stripes are `#B8633F` and sailcloth. It's the only material in a UI meaning hue and above S 45, on purpose: she *is* the debt, and she never changes era.
  - Credit-only buildings (Lantern Hall, Sun Mirror) carry **one** small pennant in her stripes, so the exception marks "this is Hesper's money".
  - Nothing else may use her stripes or the debt hue above S 45. Town's terracotta tiles must stay ≤ S 45 (for example `#A16E59`).

**Grey land (the debt signal)**
- **Shader** on the lot and everything on it, ordered by `greyOrder`:
  1. desaturate 85%, keeping luminance (prototype `col(h,k,grey)`);
  2. shift −4% toward cool;
  3. draw a 45° hatch in ink at 18% opacity, a 1.5 px line every 6 px in screen space.
- **Colour-blind safe:** it's coded by saturation plus pattern, so a greyscale screenshot of a half-grey island still shows the boundary.
- **The hatch is drawn after the day/night tint**, so it reads at night.
- **Grey means debt only.** Grey lots show fewer figures. "Disabled" never means grey: use a dim plus a lock icon.
- **The colour flood** (repaying) reverses the shader in `greyOrder`. It's code, not art.

## 5. Lighting (D3)
- **One light, from the upper left** (plan §11). It's baked into every sprite as **flat 3-step shading**: roof tops get the light step, left walls the base, right walls the shade. No gradients, no AO.
- **Cast shadow:** a separate flat ink shape at 20%, offset down-right, never blurred (plan §5).
- **Authored at neutral noon.** Dawn, dusk, night, the Long Dusk and the sun-rewind are **global tints** from code (the prototype's `lightAt` stops), plus window and torch glow sprites and the gnomon shadow sweep.
- **No normal maps in the shipped baseline.** An optional normal-mapped moving sun (high tier only) may be added after it passes the Phase 0 gate as its own pass. It must keep the flat painted read. Plan §5 is updated to match.

## 6. Paper grain
- **One static screen-space overlay,** composited once and never redrawn (plan §5): multiply at 6–8%, warm fibres, a vignette of at most 30%, from one 512² tile.
- **No grain baked into sprites.** Texture comes from brush-shaped fills, not noise, because noise breaks block compression and doubles up with the overlay.
- **UI panels** carry the grain in their own texture. Buttons don't.

## 7. Isometric tile, sprites and atlas budgets
- **Projection:** exact **2:1 dimetric**. Tile **128×64** on the high-tier atlas (the prototype's 64×32 × DPR 2), and **64×32** on the low tier. Masters are drawn at 256×128.
- **Anchor:** the bottom diamond point. Depth key is `i + j`, then height. **Tiles are drawn from a template, never by eye.**

| Footprint | Max frame (high tier) | Use |
|---|---|---|
| 1×1 | 128×192 | Looks 1–4 (all of Village) |
| 2×2 | 256×320 | Looks 5–6 |
| 3×3 | 384×448 | Look 7 |
| Figure | 32×52 | Puppet, all parts (see §10) |
| Hesper's tent, gnomon | 256×320 | Never re-skinned |

**Village atlases** (plan §5: 7 types × 4 looks = 28 frames)

| Atlas | High / low | Contents |
|---|---|---|
| Buildings | 1024² / 512² | 28 frames, Hesper's tent, gnomon |
| Ring and roads | 1024² / 512² | Palisade stages 1–4 × segment, gate and corner; roads 1–4; shore |
| Terrain and props | 1024² / 512² | Lot diamonds, plinths, crops, crates, trees |
| Units | 512² / 256² | Puppet parts: villagers, notables, the Late, Hesper, Margery, boats |
| UI kit | 2048² / 1024² | Panels, buttons, icons, era frame |

- **Compression:** KTX2.
  - **UASTC → ASTC 4×4** (8 bpp) for buildings, units and UI, where the ink lines need it.
  - ETC1S for terrain and grain only.
  - ETC2 as the fallback (GLES3 on Mali-G52 and Adreno 610), PNG as the last resort.
- **Atlas rules:** **2048² max**. Mipmaps on terrain and buildings only.
- **Memory:** a 2048² ASTC atlas is 4 MB (5.3 MB with mips), a 1024² one 1.3 MB.
  - The Village set is about **10 MB**, against the **80 MB low / 128 MB high** totals.
  - The headroom covers the next era's set during the cinematic.
- **Frames:** 2 px extrude, premultiplied alpha, trimmed, with anchor offsets in the atlas JSON.

## 8. The seven-look system
- **The 7 looks** are `rough, settled, timber, sturdy, stone, fine, grand`, one every 3 levels (`stageOf(n) = min(6, floor(n/3))`).
- **Looks reached per era** (set by the level caps): **Colony 1–2, Village 1–4, Town 1–6, City 1–7** (plan §11).
- **Per-era columns (D2):** the gameplay meaning of a look (footprint, rank) comes from the `DESIGN_V2.md` master. Its *drawing* comes from the era column below. The transformation cinematic swaps column, not look.
- **One idea per step, and every step changes the outline:**
  - 1→2: + height or a new mass (chimney, second roof);
  - 2→3: a new roof shape plus the era's signature accent;
  - 3→4: + a landmark prop that breaks the skyline (bell, wheel, cap);
  - look 5 → 2×2 and look 7 → 3×3, only into free lots behind.
- **Production:** looks are built from era kits (roof, wall, trim, plinth, props, palette ramps) and finished by hand. They are never generated whole.

## 9. Building columns per era
**Village: Hearth & Harvest (written in full; level cap 11, so looks 5–7 are not reached and the re-skin goes to Town)**

| Type | 1 rough | 2 settled | 3 timber | 4 sturdy | Silhouette rule |
|---|---|---|---|---|---|
| Field | Sprout rows | Wattle-fenced plot | Fenced wheat | Wheat + scarecrow | Flat; fence line and crop; the scarecrow is the only vertical |
| Cottage | **Round** wattle hut, low cone of thatch | **Long** hut, hipped thatch + stone chimney stack | **Tall** cruck A-frame, ridge crossed at the top, blue door | **Two-storey** daub house, jettied upper floor, thatch + chimney | Dome → long low → tall triangle → boxy two-storey |
| Clockworks | Bench + vice | Open lean-to shed | Workshop + big gear wheel | Stone-footed works + treadwheel | Wide and low; the round wheel is the read |
| Watchtower | Log stilts, open top | Log tower, platform | Timber tower, thatched cap | Round fieldstone tower, cone roof | Tallest thin vertical |
| Hourglass | Crate + glass | Stall | Round kiosk | Thatched rotunda | Circular, symmetric; glass is the only glint |
| Lantern Hall (credit) | Lantern tent | Pavilion | Timber long hall | Long hall, lantern eaves | Long horizontal + hanging lanterns + Hesper pennant |
| Trade Post | Shore crates | Awning stall | Warehouse | Counting shed + sail flag | Asymmetric awning + crate stack |
| Palisade | Stakes | Woven stakes | Log wall | Log wall + walk | Ring pieces: segment, gate, corner |
| Roads | Dirt track | Rutted track | Plank edges | Fieldstone kerb | On the hour-lines; flat |
| Never re-skinned | Hesper's tent (striped cone + hourglass sign); the gnomon (stone needle + dial ring) | | | | |

**Colony: Wreck & Frontier (stub; level cap 5, so looks 1–2 only)**: canvas, rope, ship timber, hull planks.

| Type | 1 rough | 2 settled |
|---|---|---|
| Field | Driftwood-edged sprouts | Rope-fenced plot |
| Cottage | Sailcloth tent | Upturned-hull lean-to |
| Clockworks | Sea-chest bench | Plank shed with a ship's wheel |
| Watchtower | Mast on stilts | Crow's-nest log tower |
| Hourglass | Salvage crate | Canvas stall |
| Palisade | Stakes | Woven stakes |

**Town: Gears & Gilt (stub, looks 1–6)**: brick, terracotta tile (≤ S 45), marble, brass gears. Silhouettes: domes, arcades, campaniles. Write the column before Town production.

**City: Brass & Steam (stub, looks 1–7)**: iron, glass, riveted brass, sooted brick. Silhouettes: chimneys, glass domes, clock towers. Write the column before City production.

## 10. Characters: paper puppets
- **Scale:** a villager is **0.4 of a tile high**, about 26 px on the 64 px tile diamond height (frame 32×52). Hesper is **0.55 of a tile**, tall and narrow (frame 28×72). Figures never match a building's height.
- **Parts** (6, each its own frame): head, torso, left arm, right arm, legs (one piece), prop.
- **Joints:** pins at the neck, shoulders and hip, each a **visible brass split-pin dot** (2–3 px, brass `#BFA06A` (S 44), ink ring). This is the puppet's tell, and it must show at close zoom.
- **Colour:** two fills, ink and skin. The costume colour follows the job:
  - field: moss;
  - Clockworks: oak;
  - watch: driftwood;
  - trade: ochre.
- **Faces:** two ink dots, no mouth. **No blue clothing** (the blue door rule).
- **Animation (code, GSAP or sine on the pins):**
  - idle: bob 1 px at 0.4 Hz, head tilt ±3° every 3–6 s;
  - walk: a 2 px hop at 2 steps/s, legs ±12°, x-flip to turn;
  - work: one arm loops ±25°;
  - hungry: sits, 60% grey, no bob;
  - wounded: sling, arm locked.
- **Low tier:** bake each pose to 2 frames.
- **Hesper:** tall and thin, a long dark coat with a terracotta stripe sash and a ledger prop, never changes era.
- **The others:** Margery is a goat with 4 parts. The Late are tar-grey silhouettes with mixed-era props.

## 11. UI style
- **Panels:** paper with grain, a 2 px ink border, 10 px corners.
  - Each era has its own frame skin. Village: **carved oak** edges and an **illuminated initial** on titles (plan §11).
  - The `kit/` keeps the layout and the meaning colours.
- **Buttons:**
  - Primary is action gold with an ink outline and a 3 px lip; pressed means the lip is gone. **One gold button per screen.**
  - Village secondary buttons are wax seals in deep sea-teal `#3F7473` (a D1 constant). Red wax is avoided because it would read as debt.
- **Icons:** 48 px grid, a 3 px ink line, at most one fill. Hand-drawn.
  - Hours: a sun-hourglass.
  - Debt: a cracked hourglass.
  - Safe: a wax-seal tick.
  - People: a puppet head.
- **Fonts:**
  - **Alegreya** (OFL) for headings.
  - **Alegreya Sans** for body, with tabular numerals.
  - Body text is at least 14 px, tertiary at least 12 px. Title case only on sheet titles.
- **Copy:** one line per beat. No puns on warning lines.

## 12. Code-driven vs hand-drawn
| Code | Hand-drawn (kit + hand finish) |
|---|---|
| Time-of-day tint, sun-rewind, Long Dusk sky | Every building look, palisade and road piece |
| Gnomon shadow sweep | Gnomon, dial ring, Hesper's tent |
| Grey-land shader and colour flood | Puppet parts and props |
| Smoke, hour motes, sparks, arrows, fire (≤ 300 particles) | 3–4 hand-drawn fire and smoke puffs |
| Puppet animation on pins | Icons, panel frames, illuminated initials |
| Sea shimmer, foam, boat bob | Shore, terrain diamonds, crops |
| Era transformation wash, seizure lift | Era kits and palette ramps |
| Static grain overlay | The grain texture itself (painted or scanned once) |
| Optional high-tier dynamic light (D3) | — |

## 13. Do and don't
**Do**
- Leave ground empty: at most one prop per lot.
- Let lines wobble, with one deliberate flaw per building.
- Keep one accent colour per building, repeated across the island.
- Make each look change the outline with **one** idea.
- Check at fit zoom on a real phone, in greyscale and in CVD simulation.
- Write a building's one-line lore reason before drawing it.

**Don't**
- Glossy highlights, rim lights, blanket bloom, lens flares or god rays.
- Golden-hour tint baked into sprites. That's code's job, and the option-D reference itself is too amber.
- Saturated lime grass or candy-red roofs.
- The same symmetric "hero" pose for every building, or the cliff-island diorama framing.
- Micro-detail noise: counted shingles, pebbles, tufts everywhere.
- Text baked into art, extra fingers, or props that don't match.
- **Shipping any generated image as a game asset.** Generated images are mood references only.
- Grey or desaturation for anything but debt, or blue for anything but the Village door.
