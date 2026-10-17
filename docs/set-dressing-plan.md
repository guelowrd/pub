# Set dressing per song: the engine side (2026-10-17)

Companion to `designer-brief-9.md`. What the engine takes per song, how each piece is drawn, and the performance guard. Gaylord's rule: the game must not slow down on a modest machine.

## Per-song table (stations.ts gains a `feel` block per station)

Knobs, pushed one notch from the first proposal. Traffic is extra cars over the district's base (`TRAFFIC`), hazards is rolls per street (today 7), the mix is the weighted kinds list, curves and hills scale the strengths the generator rolls.

| # | Stage | Traffic | Hazards | Mix | Curves | Hills |
|---|---|---|---|---|---|---|
| 1 | NOCTURNAL RUN | 0 | 4 | cone, oil | 1.0 | 1.3 |
| 2 | SYNTHWAVE ENGINE | +1 | 7 | cone, cone, oil, pothole | 1.2 | 0.8 |
| 3 | ABANDONED FACTORY | +1 | 12 | pothole, pothole, barrier, barrier, oil | 0.9 | 0.5 |
| 4 | MIDNIGHT CHASE | +3 | 6 | cone, oil, pothole | 1.3 | 1.0 |
| 5 | OUTRUN PULSE | 0 | 5 | cone, oil | 1.5 | 0.4 |
| 6 | VECTOR WORLD | +1 | 9 | cone, cone, cone, oil | 1.3 | 1.3 |
| 7 | PICKUP TRUCK | +1 | 9 | pothole, pothole, barrier, cone | 1.0 | 1.8 |
| 8 | DARK HORSE | 0 | 7 | pothole, oil, barrier | 0.7 | 1.8 |
| 9 | BITTERSWEET SUNSET | -1 | 3 | cone, oil | 0.9 | 0.8 |
| 10 | NEON PURSUIT | +3 | 10 | cone, cone, oil, oil | 1.5 | 0.6 |
| 11 | ORANGE HORIZON | 0 | 4 | cone, pothole | 1.2 | 1.5 |
| 12 | NIGHT CRUISE | -2 | 2 | cone | 0.7 | 0.4 |
| 13 | PICK UP OR CRUSH UP | +3 | 12 | cone, cone, oil, pothole, barrier | 1.0 | 1.0 |

Wind on the rainy songs: FACTORY strong, DARK HORSE strong, NEON PURSUIT light (scale the 0.9 m/s crosswind by 1.4, 1.4, 0.7).

The generator (`course.ts node()`) reads the song's rolls and mix and scales curve and hill strengths. The rng call order stays stops first, then hazards, then lights, so stops are not disturbed within a node; the courses still change, which is fine before deploy. `rules.ts` and the MASM replay check stops and top speed only, untouched.

## Per-song dressing (`stations.ts`, a `dress` block per station)

| # | Lamp | Props replacing the district decor | Traffic set | Sky element | Ambient effect | Curbs |
|---|---|---|---|---|---|---|
| 1 | golf | district default | default | moon | stars, fireflies, festoon lights | gold / white |
| 2 | downtown | billboards x2 | default | synthwave sun (engine) | neon beat wash | cyan / magenta |
| 3 | bulkhead | fence, smokestack, barrels, dock | truck, van only | none | smoke, lightning, steam, lamp flicker | grey / yellow stripes |
| 4 | downtown | water tower, antenna mast | default, more sedans | helicopter | searchlight cone, beacon blink, tail streaks | white / red |
| 5 | waterfront | tall palm, umbrella, lifeguard tower | default | gulls | sun glare on the water | red / white |
| 6 | casino | triangle, circle, diamond pylons | default | blimp with LED text | ground grid, horizon glow lines | cyan glowing dashes |
| 7 | golf | fence, hay bales, tractor, windmill | pickup, rv | none | verge dust puffs | default |
| 8 | golf | dead trees x2, chapel wall, crow post | default | none | fog banks, far lightning, headlights on | dim |
| 9 | waterfront | couples x2 | default | Ferris wheel (two layers) | wheel rotation, rail string lights, sun flare | pink / white |
| 10 | casino, beat pulse | neon gate every 200 m | taxi, limo | none | wet streaks under lamps and gates, speed lines, tinted rain | default |
| 11 | golf | vineyard row, olive tree | default | balloons x3 | starling flock (20 dots) | warm |
| 12 | waterfront, spacing x2 | boats x2, lighthouse | sparse | none | lighthouse beam, moon path on water | dim blue / white |
| 13 | casino | road closed sign, digger, cone row, water barrier, tube man | bus, convertible | none | tube man flap, horn callouts | yellow / black |

## How each engine piece is drawn, with its budget

All of these are a handful of path fills or sprite draws per frame. The frame today costs about 8 ms on Gaylord's Mac, most of it the frontage band (up to 280 pattern fills) and the materials.

- **Props per song**: the song's sheet replaces `DECOR[district]` in the furniture loop (every 55 m) and, where listed, `TREES`. Same count as today, zero added cost.
- **Lamp per district / song**: `prop(z, x, "lamp")` reads the song's lamp sheet. Same count. Spacing x2 for NIGHT CRUISE halves it.
- **Traffic set**: `extend()` picks kinds from the song's list instead of all six. Same count.
- **Curbs**: the two curb colours come from the song; the stripe variant alternates per slice. Free.
- **Sky element**: one sprite drawn after the skyline at a fixed screen place with the skyline's parallax; animated pieces alternate two frames every 120 ms. One draw.
- **Stars**: 60 points precomputed once, alpha from a sine of time. One path.
- **Fireflies**: 24 dots on the verges, positions from a hash of index and time, drawn in the sprite pass at their z. 24 tiny arcs.
- **Festoon lights**: between consecutive lamp posts on each side, one quadratic curve and 8 bulbs. About 16 spans visible: 16 curves, 128 small arcs.
- **Synthwave sun**: one radial gradient disc clipped by 6 horizontal bands. One fill plus a clip.
- **Neon beat wash**: one additive gradient rect over the frontage's screen band, alpha from the beat. One fill. (Not a second pass of the band.)
- **Smoke**: 3 plumes of 10 puffs, the existing puff sprite, drifting up. 30 sprites.
- **Lightning**: a 2-frame white flash of the sky rect, random every 8 to 14 s. One fill.
- **Steam vents**: reuse the skid puffs at fixed road spots. 10 sprites.
- **Lamp flicker**: alpha on the lamp draw from a hash. Free.
- **Searchlight**: one gradient polygon from the helicopter to a road point that sweeps. One fill.
- **Beacon blink**: the beacon cell drawn on a 1 s cycle. Free.
- **Tail streaks**: one short additive line per traffic car when its speed is above 100 km/h. Up to 12 lines.
- **Gulls, starlings, balloons**: 6 gull sprites, 20 starling dots, 3 balloon sprites. Cheap.
- **Sun glare / flare**: 3 radial gradients. Cheap, and only when the sun is on screen.
- **Ground grid**: lines every 10 m across and 4 lines along, beside the road, over the near 60 segments. About 30 lines in one path.
- **Blimp text**: one `fillText` clipped to the panel. One draw.
- **Verge dust**: the skid puff system at the wheel when x is beyond the road edge. Already budgeted.
- **Fog banks**: 3 gradient bands between the horizon and the near ground, alpha by the hill depth at that distance. 3 fills.
- **Wheel rotation**: the lights layer drawn with a rotation. One draw.
- **Rail string lights**: as the festoon, on the frontage line. 16 curves.
- **Wet streaks**: one vertical additive gradient per lamp and gate within 150 m. Up to 10 fills.
- **Speed lines**: 20 radial lines from the vanishing point above 200 km/h. One path.
- **Lighthouse beam**: one rotating gradient triangle. One fill.
- **Moon path**: one additive gradient strip on the water. One fill.
- **Tube man**: two frames alternating. Free.
- **Horn callouts**: text, exists.

## Cut (too costly in canvas 2D)

Heat shimmer (per-pixel), long cast shadows (a second draw per prop), full frontage reflection (a second band pass), large murmurations (hundreds of particles).

## The performance guard

- Measure the frame interval in the loop; keep a 60-frame median.
- If the median exceeds 20 ms for 2 s, drop to the low tier: ambient particles off (stars, fireflies, smoke, steam, flocks, speed lines), frontage strips forced to 1 per slice, the decal highlight pass off, the frontage drawn to 70 segments instead of 140. Never climb back during a run (no flapping).
- A `?low=1` query flag forces the tier for testing.
- Verify with Chrome DevTools CPU throttling at 6x on the busiest stages (PICK UP OR CRUSH UP, NEON PURSUIT, ABANDONED FACTORY) before and after each batch.

## Order of work once the art lands

1. The `feel` knobs and the generator (no art needed, can start now).
2. Lamps per district, props per song, traffic sets, curbs.
3. Sky elements and the cheap ambient effects (stars, fireflies, festoon, sun, grid, fog, beams, paths).
4. The performance guard, then the throttled check.

## Status

- 2026-10-17: step 1 done. `Feel` per station in `stations.ts`, the generator reads rolls, mix, curve and hill scales,
  `extend()` adds the song's traffic, the crosswind takes the song's strength. Every waterfront street rises (a hill on
  every stretch, always positive) so the water shows from the crests, Gaylord's ask. Courses changed, so
  `rules/vectors.json` was regenerated and the two pinned commitments in `chain/__tests__/game.test.ts` updated; the
  Rust replay passes on the new vectors (4 tests).
- 2026-10-17, later: steps 2 to 4 done from the designer's PUB-Track-Signatures pack. `art.ts` holds the lamp sheets
  (`lampOf`), the per-song `LOOK` (props, tall pieces, curbs, dash, lamp gap, sky files) and `loadLook`; `render.ts`
  draws the lamps, the song's pieces in the furniture and tree slots, the sky pieces and every ambient effect of the
  table above within its budget, and runs the guard (`?low=1` to force the low tier). Traffic sets live in
  `stations.ts` `feel.cars`. All 13 stages checked in Chrome; the throttled check remains to be done by hand.
