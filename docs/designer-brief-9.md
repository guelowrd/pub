# Pick Up Boomers, one look per song (2026-10-17)

The thirteen stages share one world today: the district's skyline, frontage, venues and street furniture, under the stage's hour and weather. Gaylord wants each song to look like itself. This brief is the art for that: a lamp post per district, and for each song three or four signature pieces, mostly roadside props and one element in the sky. The engine does the rest (effects, lights, grids, flocks, flares), so this brief lists for every song both what you draw and what you do not draw, so nothing is done twice.

Performance is a constraint: the game must keep its frame rate on a modest laptop. Every element here was chosen to cost no more than what the game draws today. A few ideas were cut for that reason (heat shimmer, long cast shadows, neon reflections of the whole frontage, big bird murmurations). Nothing you draw adds cost by itself; the counts and effects are the engine's side.

## The songs and their moods, in Gaylord's words

| # | Stage | District, hour, weather, car | Mood |
|---|---|---|---|
| 1 | NOCTURNAL RUN | Golf Hills, night, clear, white | very happy, feel-good, melodic |
| 2 | SYNTHWAVE ENGINE | Downtown, sunset, clear, yellow | energetic, rhythm, sad but a bit happy, arpeggios |
| 3 | ABANDONED FACTORY | Downtown, night, rain, black | scary, sad, brutal, mysterious, powerful |
| 4 | MIDNIGHT CHASE | Downtown, night, clear, violet | epic, a bit sad, hopeful, melodic |
| 5 | OUTRUN PULSE | Waterfront, midday, clear, red | arpeggio, rather sad, focused, hopeful |
| 6 | VECTOR WORLD | Casino Strip, sunset, clear, green | epic, arcade, melodic, romantic fake-sad, powerful |
| 7 | PICKUP TRUCK | Golf Hills, midday, clear, beige | arpeggios, struggle then win, vibrato, powerful moments |
| 8 | DARK HORSE | Golf Hills, night, rain, brown | dark, slow big beat, driven, epic, vocoder |
| 9 | BITTERSWEET SUNSET | Waterfront, sunset, clear, orange | romantic, dumb smile, melodic, not really sad |
| 10 | NEON PURSUIT | Casino Strip, night, rain, blue | fast, rhythm, playful, vocoder, thrill |
| 11 | ORANGE HORIZON | Golf Hills, sunset, clear, gold | powerful yet contemplative, sad-ish, some epic |
| 12 | NIGHT CRUISE | Waterfront, night, clear, indigo | quiet, driven pulse, sad-ish memories, c'est la vie |
| 13 | PICK UP OR CRUSH UP | Casino Strip, midday, clear, pink | arpeggios, driven pulse, determined, just drive |

Every song also gets its own driving (traffic, hazards, curves, hills). That is engine work and needs no art, except the vehicles named below.

## Formats, the same as your earlier packs

- **Roadside props**: 512 x 512 cells, four columns per sheet, ground contact at the cell's bottom centre (256, 460), transparent background, painted for the song's hour. One `metadata.json` per sheet with each cell's name and its world height in metres; the engine derives the scale. Props are drawn mirrored on the left side of the road, so avoid readable text on them.
- **Tall props** (smokestack, lighthouse, pylons, windmill): 512 x 1024 cells, ground contact at (256, 980).
- **Vehicles**: like the traffic sheets, 724 x 724 cells, three columns (steering left, straight, right) and two rows (lights normal, braking), rear three-quarter view, ground contact at (362, 565), with the vehicle's length in metres in the metadata.
- **Sky elements**: free size up to 1024 px wide, transparent, drawn above the horizon with a slow parallax. Soft edges and glows can be painted in, the engine will not add any.
- **Road-spanning pieces** (neon gates): 2048 x 1024 like the fork gantry, the road passing under the middle 720 px, ground contact row 928.
- **Animated pieces**: two frames side by side in one sheet (rotor, flap, tube man, neon frames). The engine alternates them.
- Transparent WebP or PNG. Night pieces take the night palette of the existing world; day and sunset pieces, the daylight palettes from the world lighting pack.

## Lamp posts, one per district (replaces the current double-globe post everywhere)

The current post is drawn on every street, 40 m apart on both sides. Four new ones, 512 x 1024 cells, about 8 to 9 m tall, each lit as its district's night, plus a midday and a sunset face where the lamp is off (3 sheets of 4 cells, or 12 cells in one sheet, your call):

1. **Waterfront**: a tall slender promenade lamp, one frosted globe, sea-green pole, a small lifebuoy ring bracket.
2. **Downtown**: an Art Deco lantern on a fluted pole, warm white, chrome bands.
3. **Casino Strip**: a neon-tube pylon with a chevron head, magenta and cyan tubes.
4. **Golf Hills**: a low stone bollard lantern, warm amber, about 1.2 m tall (this one is a 512 x 512 cell).

One song overrides its district lamp: **ABANDONED FACTORY** gets a caged sodium bulkhead on a raw concrete pole, orange light. The engine flickers it.

## Per song: what you draw, what the engine does

**1. NOCTURNAL RUN** (golf hills, night)
- You draw: a big full moon, low and warm, with its halo painted in (sky element, 1024 x 1024).
- Engine: twinkling stars, fireflies over the verges, festoon string lights hung between the lamp posts, gold and white curbs.

**2. SYNTHWAVE ENGINE** (downtown, sunset)
- You draw: two rooftop billboard props with animated neon frames (two frames each), sunset palette.
- Engine: the synthwave sun with its horizontal cut lines between the towers, cyan and magenta lane dashes and curbs, a beat pulse on the neon.

**3. ABANDONED FACTORY** (downtown, night, rain)
- You draw: an industrial props sheet: a chain-link fence run, a smokestack (tall cell), a stack of rusted barrels, a dead loading dock with a broken sign; and the caged bulkhead lamp above. All night, wet.
- Engine: smoke plumes from the stacks, lightning flashes, steam vents on the road, flickering lamps, trucks and vans only in the traffic, grey curbs with yellow hazard stripes.

**4. MIDNIGHT CHASE** (downtown, night)
- You draw: a helicopter seen from below and behind, two rotor frames (sky element, 512 x 512); a rooftop water tower and an antenna mast with a red beacon lens (props, the beacon as a separate small cell the engine blinks).
- Engine: the searchlight cone sweeping the road, beacon blink, tail-light streaks on the traffic at speed, white and red curbs.

**5. OUTRUN PULSE** (waterfront, midday)
- You draw: a second palm (taller, a double avenue with the existing one), a beach umbrella, a lifeguard tower (props), a seagull with two wing frames (256 x 256, sky element).
- Engine: a small flock of those gulls crossing, sun glare on the water, classic red and white curbs.

**6. VECTOR WORLD** (casino strip, sunset)
- You draw: three giant geometric casino pylons in neon outline, a triangle, a circle, a diamond (tall cells); a blimp with a blank LED panel on its flank (sky element, 1024 x 512), the panel transparent so the engine writes on it.
- Engine: a faint vector grid on the ground beside the road, horizon glow lines, scrolling text on the blimp, cyan glowing lane dashes.

**7. PICKUP TRUCK** (golf hills, midday)
- You draw: a country props sheet: a wooden fence run, hay bales, a parked tractor, a windmill (tall cell); a pickup truck for the traffic (vehicle sheet).
- Engine: pickups and RVs in the traffic, dust puffs when a wheel touches the verge.

**8. DARK HORSE** (golf hills, night, rain)
- You draw: two bare dead trees, a ruined chapel wall with an empty window, a crow on a fence post (props, night, wet).
- Engine: low fog banks over the ground, thicker in the dips, far lightning, headlights always on, dim curbs.

**9. BITTERSWEET SUNSET** (waterfront, sunset)
- You draw: a Ferris wheel on the pier in two layers, the structure and a cabins-and-lights layer the engine rotates (two 1024 x 1024 sky elements, same centre); two couples on benches (props).
- Engine: the wheel turning, string lights along the promenade rail, a huge low sun with a lens flare, pink and white curbs stay.

**10. NEON PURSUIT** (casino strip, night, rain)
- You draw: a neon gate spanning the road, WELCOME-style, no readable word (road-spanning piece); a taxi for the traffic (vehicle sheet).
- Engine: a gate every 200 m, neon streaks on the wet asphalt under the lamps and gates, speed lines past 200 km/h, rain tinted by the neon, limos and taxis in the traffic, the casino pylon lamp pulsing with the beat.

**11. ORANGE HORIZON** (golf hills, sunset)
- You draw: a vineyard row, an olive tree (props); three hot air balloons (sky elements, 512 x 512 each).
- Engine: the balloons drifting, a small starling flock turning far away, warm curbs.

**12. NIGHT CRUISE** (waterfront, night)
- You draw: a lighthouse (tall cell) with the lamp room marked in the metadata so the engine starts the beam there; two moored boats with cabin lights (props).
- Engine: the sweeping beam, the moon path on the water, lamps twice as far apart, dim blue and white curbs.

**13. PICK UP OR CRUSH UP** (casino strip, midday)
- You draw: a roadworks sheet: a ROAD CLOSED sign (the words are fine here, it is never mirrored), a small digger, a row of cones, a water-filled barrier; an inflatable tube man with two frames.
- Engine: roadworks along the street, tube men at the venues, buses and convertibles in the traffic, horn callouts, yellow and black curbs.

## Cut for performance, so you know why they are missing

- Heat shimmer on the far road (PICKUP TRUCK): a per-pixel distortion, too costly in the engine's canvas.
- Long cast shadows under every prop (ORANGE HORIZON): doubles every sprite draw.
- Reflections of the whole frontage on the wet road (NEON PURSUIT): doubles the band draw; replaced by streaks under the lamps and gates.
- A full starling murmuration: capped at a small flock.

## Delivery

One folder per song is easiest (`01-nocturnal-run`, `02-synthwave-engine`, ...), plus one `lamps` folder, each with its sheets and `metadata.json`, and a review board per song. Same naming discipline as the world lighting pack.

## Facts you can rely on

- Districts, hours, weathers and car colours are fixed as in the table.
- Frontage bands, skylines, venues, destinations, portals and the HUD are unchanged.
- The engine mirrors props for the left side, draws sky elements with parallax, and owns every light, glow, flicker, particle and line listed under "Engine".
