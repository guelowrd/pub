# Pick Up Boomers: art brief 2

Thanks for both packages. The look is right and I'm keeping all of it: splash, skyline, asphalt, car poses, the sixteen
characters, the HUD kit, PUB Pixel, and from the world package the eight venues, the street props, the street recipes, the
gantry signs and the fork composition. I reworked the gameplay into a proper arcade game, so this brief explains the new game
and lists the art it now needs.

## The game now

A 3-minute arcade driving run, one song long. You drive the silver wedge car through a neon city full of traffic, pick up
boomers and drive them where they want to go. Most points in 3 minutes wins. OutRun for the road and the forks, Crazy Taxi
for the passengers.

- **Driving comes first.** Same-way traffic in your lanes, cones, oil slicks, potholes, roadworks that close a lane. A crash
  spins you out and costs seconds. A crash at high speed is a wreck: your riders bail.
- **Forks lead into districts**, as you proposed in batch 01. Every ~36 seconds a gantry sign names the district down each
  branch (Downtown, Waterfront, Casino Strip, Golf Hills) with its destination icon, five legs per run. Faces and radar show
  only on approach to each stop. Each street has 3 to 5 stops, one collectible person per stop, drawn from the venue's pool
  in `venues.json`.
- **Twelve venues.** Your eight (school, nursing home, aquagym, bar, bingo, arcade, market, garage) line the district streets
  as pickup places. The four new ones, the **casino**, the **cruise terminal**, the **golf club** and a **fancy restaurant**,
  are the drop-offs, one per district. People wait at all twelve.
- **Pickups.** You come in hot and skid into the bay (the "crazy stop"). Stop with the door alongside the person and they hop
  in automatically. Their age shows when they board.
- **Three seats, four spending places.** Every rider wants to go to one of the four new venues: casino, cruise terminal, golf
  club or fancy restaurant. You carry them there and do the same crazy stop at its bay; their points bank when they get out.
  Two or three riders dropped together at the same place score a multiplier. Nobody wants the district they're picked up
  in. So each fork is a dilemma: GOLF HILLS to drop your two golfers, or CASINO STRIP for one drop and better faces?
- **Age scoring.** Full points for ages 70 to 80. Below 70 the points drop slowly down to age 20; above 80 they drop fast
  down to 100. Boomer Radar stays as you designed it: an honest range with TIGHT / FUZZY / WILD.
- **Radio.** Before the run you pick one of fourteen tracks, like OutRun's station select. The song is the run.

## Rules in numbers

- **Age points**, per rider: 1000 for ages 70 to 80. Below 70, minus 20 per year (60 → 800, 50 → 600, 40 → 400, 30 → 200,
  20 and under → 0). Above 80, minus 50 per year (85 → 750, 90 → 500, 95 → 250, 100 → 0).
- **Group drop**: two riders dropped together at the same place score x1.5 each, three score x2.
- **Distance**: 1 point per metre to start, about a third of a good run's total; tuning may change the rate. SCORE ticks up
  live as you drive, rider points land on drop-off, and results show distance on its own line.
- **Time up**: riders still aboard score nothing. Results list them as still on board with their lost points, so the next
  run you drop them sooner.
- **Full car**: with all three seats taken nobody boards. The seats panel shows a FULL state, the radar card swaps the range
  for CAR FULL and the bay isn't highlighted. Passing costs nothing.
- **Timing**: five legs, four forks, about 36 seconds per leg. The clock is exactly 3:00 for every track; each song is
  trimmed or faded to end at 0:00.

**Tone.** The four spending places carry the satire: boomers only think about themselves and about spending money that came
easily in their day, will deny it until they die, wrecked the planet and are unapologetic about it. Let that show in those
buildings, their props and the characters: golf bags, cruise wear, designer shopping bags, gas guzzlers, sprinklers running in
a heatwave. Keep it playful. Fictional adults only, no real people or likenesses, no logos or readable brand names.

**What changes from your brief:** the clock is 3:00, the target is a band (TARGET 70-80), boarding is automatic (no PICK UP
button), riders stay aboard until their drop-off, streets hold 3 to 5 stops, and the road has traffic and hazards. Camera,
road / bay / sidewalk geometry, gantry signs, phone direction row, palette and HUD style stay as they are.

## Technical frame

- The renderer is Canvas 2D pseudo-3D: OutRun-style road segments, every sprite a billboard scaled by depth. Draw everything
  from the same low rear chase camera as the hero car. Facades stay billboards at all distances, so no directional facade
  sprites are needed.
- Roadside buildings and props face the road in slight 3/4 view, drawn for the **right** side. I mirror them for the left,
  so avoid text or one-sided details that look wrong when flipped.
- Ground items (oil, potholes, bay markings) come already squashed to the camera angle: a flat ellipse seen from the
  driver's eye height.
- Same delivery format as before: PNG masters + WebP, real alpha, individual trimmed sprites with measured crops and
  bottom-center pivots in a metadata JSON (like `world-metadata.json`), and the generation prompts in a provenance file.
- Scale: match `car-poses` cells (724 x 724) for vehicles, `passengers` cells (256 x 384) for people, your venue sprites for
  buildings.

## Asset list

### 1. Traffic vehicles (priority 1)
Six same-way vehicles seen from behind, each in three poses like `car-poses` (left yaw, straight, right yaw) plus the same
three with the brake lights on:
- big gas-guzzler SUV
- luxury sedan
- motorhome / RV (wide and slow)
- convertible with a boomer couple in it
- delivery van
- tour bus or truck (the heavy one)

Same lighting and finish as the hero car. Unbadged, no readable plates.

### 2. Hero car extras (priority 1)
- Brake lights on: the three existing poses with bright tail lights.
- Spin-out sheet: 8 angles around the car (rear, rear 3/4 left and right, side left and right, front 3/4 left and right,
  front), same scale and ground baseline.

### 3. Hazards (priority 1)
- traffic cone, single and a cluster of three
- oil slick (ground, squashed ellipse, rainbow sheen under the neon)
- pothole (ground, squashed)
- roadworks: striped barrier section, sawhorse with a flashing lamp, arrow board (arrow only, no text)

### 4. Effects (priority 1)
- skid smoke: a puff sheet of 6 to 8 frames, tinted by the neon
- wreck: an impact burst sheet (flash, glass, debris)

Code draws the rest: tyre marks, sparks, the boarding step and fade, and the bailout (riders tumble out with their existing
full-body sprite and land on the sidewalk). Tell me if you'd rather paint any of these.

### 5. The four spending places (priority 2)
Four venue buildings matching your eight (same view, light and finish, blank nameplates, the name lives on the gantry):
- **Casino**: gaudy neon, gold, fountains.
- **Cruise terminal**: terminal building with a huge cruise ship behind it, smokestack fuming.
- **Golf club**: clubhouse, glowing green lawn, sprinklers on, golf carts.
- **Fancy restaurant**: valet stand, red carpet, chandeliers in the windows.

For each one:
- a gantry sign name (CASINO, CRUISE, GOLF CLUB, RESTAURANT or your shorter call)
- a street recipe like yours, with 2 or 3 extra props if the current set can't carry it (yachts and bollards for the
  cruise terminal, a fairway fence for the golf club)
- a `venues.json` entry: who waits outside, the surprise, a weighted pool
- a drop-off bay: ground marking plus a small sign or arch, colour-coded per place
- a small HUD icon in the PUB Pixel style (chip or dice, ship, golf flag, cloche); it marks a rider's destination everywhere
  in the HUD

### 6. Screens and HUD (seats panel priority 1, the rest priority 2)
Boards in your format: desktop 1280 x 960, phone portrait 390 x 844, phone landscape 740 x 340.
- **Seats panel**: three seats, each with the rider's portrait, destination icon, revealed age and points; empty seat state
  and FULL state. It shares space with Boomer Radar and the selected-venue label, so find a layout for all three.
- **Radar card**: add the waiting person's destination icon; copy TARGET 70-80; CAR FULL state.
- **Gantry signs**: district name and destination icon, plus a badge (icon + count) when riders aboard want that place; the
  phone direction row repeats it. No face cards at the fork.
- **Radio select**: fourteen stations before the green light. All tracks are synthwave / outrun in the Kavinsky or Lazerhawk
  vein; each card shows a title and a mood:
  Abandoned Factory / dark industrial, Bittersweet Sunset / wistful golden hour, Dark Horse / underdog grit,
  Midnight Chase / flirty slow chase, Neon Pursuit / tunnel-light rush, Night Cruise / laid-back cruising,
  Nocturnal Run / sleek after dark, Omotesando / city pop, Orange Horizon / storm to glory,
  Outrun Pulse / classic arcade drive, Pick Up Or Crush Up / cheeky mayhem, Pickup Truck / hard-won triumph,
  Synthwave Engine / revving retro, Vector World / wireframe cool.
- **Results**: total, riders delivered, distance points, riders still on board (lost points), best, SAME RUN / NEW RUN.
- **Callouts**: CRAZY STOP!, WRECK!, RIDERS BAILED, and the group drop label (x1.5 / x2).
- **Mobile controls**: LEFT, RIGHT, BRAKE, GAS, as in your fork boards (no PICK UP button).
- **Retire**: the PICK UP prompt (boarding is automatic); keep BRAKE, PULL IN and NEXT STOP.

### 7. Characters (priority 3)
32 new fictional adults (48 in total), each with a portrait and a full-body waving sprite in the same two atlas formats, plus
`characters.json` entries (id, name, age, clues). Spread them across the twelve venue pools in `venues.json`. The age spread is
what makes reading matter:
- 6 aged 18 to 45 who could pass for older (tired, grey early, dressed old)
- 6 aged 46 to 61
- 12 aged 62 to 85, the core, many of them around 70 to 80
- 4 aged 86 to 99
- 4 who look younger than they are (cosmetic work, dyed hair, gym-fit), like Dolly

Lean into the satire in clothes and props: golf visors, cruise lanyards, designer bags, deep tans, fur, gold watches,
"spending my kids' inheritance" energy. Every reveal must stay plausible for the authored age.

## Order

1. Traffic, hero car extras, hazards, effects and the seats panel: they make the new driving.
2. The four spending places and the remaining screens.
3. The characters.
