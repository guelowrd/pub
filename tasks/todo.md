# Pick Up Boomers: plan

Design packages (art, HUD kit, boards; their gameplay is replaced by the rules below):
- v1: `~/Code/pub/Pick-Up-Boomers-Design-Handoff 1`
- v2 (world, venues, gantry signs): `~/Code/pub/Pick-Up-Boomers-Design-Handoff 2`
- v3 (arcade batch 01: traffic, hero brake + spin, hazards, effects, destination icons, drop-off markings, HUD boards):
  `~/Code/pub/Pick-Up-Boomers-Design-Handoff 3`. Production sheets in `assets/arcade/atlases` + `atlas-metadata.json`
  (fixed anchors); ignore the `.partial` leftovers.

Onchain mechanic: GQ's champion/rival notes (`~/Code/gq`, `docs/build-your-own-game.md`).

## Decisions (Q&A 2026-10-15)

| topic | decision |
|---|---|
| core skill | driving first (OutRun / Crazy Taxi); faces are the targeting layer |
| clock | fixed 3:00, one song; most points wins |
| pickup | crazy stop: brake hard (steer to skid), stop with the door in the bay, rider boards automatically (no button) |
| danger | same-way traffic + hazards (cones, oil slick, potholes, roadworks closing a lane) |
| crash | spin-out costs time; a hit above ~80 km/h is a wreck and unbanked riders bail |
| riders | 3 seats; each rider wants one of the 4 spending places; points bank on drop-off |
| venues | one list of 12: designer's 8 (school, nursing home, aquagym, bar, bingo, arcade, market, garage) + casino, cruise terminal, golf club, fancy restaurant. People wait at all 12; riders only ever want the 4 spending places |
| districts | (v3, adopted) every street is one of 4 districts, each holding its spending place's drop bay: Downtown / restaurant (cloche, yellow), Waterfront / cruise (ship, cyan), Casino Strip / casino (chip, pink), Golf Hills / golf (flag, mint). The designer's 8 line the streets as pickup places |
| forks | OutRun map, a fork every ~36 s; gantry signs show district name + destination icon + a badge when riders aboard want it (icon + count); phones repeat it in the direction row. No face previews at the fork; faces and radar only on approach |
| HUD | v3 boards as the base, trimmed: no NEXT LEFT / RIGHT face cards, no CHOOSE A ROAD, no ON BOARD n/3, no + on EMPTY, no in-run title. Keep TO BANK, FULL, CAR FULL, DROP OFF, SPIN OUT!, results screen. Right rail compact so the bay next to the car stays visible |
| stops | 3 to 5 per street, one collectible person per stop; the venue's weighted pool picks who (venues.json) |
| drop-off | crazy stop at the spending place's bay, same move as pickup |
| missed destination | rider rides on, blocking a seat; riders still aboard at 0:00 score nothing |
| multiplier | 2 or 3 riders dropped together at the same place: x1.5 / x2 |
| age scoring | 1000 inside 70-80; below 70 minus 20/yr (20 and under = 0); above 80 minus 50/yr (100 = 0) |
| distance | about a third of a good score |
| radar | as designed: one honest range per passenger, TIGHT / FUZZY / WILD, contains the true age |
| faces | bigger roster, fixed ages; later: "acts like a boomer" traits can lower points |
| ramp | streets have their own character (designer's recipes), traffic thickens leg by leg |
| music | in `temp/`: `Boomers` loops on splash and menus, `Wireline Cosmos` loops on results and challenge screens (record, claim), the other 14 are level tracks for radio select (all ~3:00); the song is the run |
| onchain verdict | decision log replayed by the note script |
| record locks | course (seed) + song |
| token | Gamecoin, shared with GQ |
| art | the other designer agent, from `docs/designer-brief.md` |
| repo | `~/Code/pick-up-boomers`, remote `github.com/guelowrd/pub` (empty, created 2026-10-15), GQ challenge code copied in; push after each milestone |
| renderer | Canvas 2D pseudo-3D (road segments + sprite billboards) |
| first milestone | feel first: graybox solo drive |

## Game rules v1

**Run.** 3:00 of active time, pause and blur excluded. Score = banked rider points + distance points.

**Course.** Generated from a seed. OutRun pyramid: leg k has k streets, from street i you fork to i or i+1. Streets have a
fixed length (sized in M2 so a good run ends around leg 5); the pyramid is generated 7 legs deep (28 streets) so the clock
ends the run, and past the last street the road runs on empty. Each street is one of the 4 districts, different from its
parents and from its neighbour on the leg, so a fork always offers two districts other than the one you're in. A street
starts with its drop bay, then 3 to 5 stops at its pickup venues, with traffic and hazards throughout. A stop is a bay with
one waiting person drawn from that venue's pool, an honest radar range and a destination icon shown before boarding. A rider
never wants the district they're picked up in, so every delivery crosses a fork and the next fork offers their place 2 times
in 3. The HUD shows the course map (the pyramid, colour-coded by district, you on it) so forks can be planned.

**Driving.** Top speed, acceleration, braking and steering tuned in M1. Traffic moves the same way; hazards: cones (bump),
oil (grip loss), potholes (speed drop), roadworks (lane closed for a stretch). Bump = short slowdown; hit above the wreck
threshold = spin-out (~2.5 s) and every rider aboard bails. The threshold is on closing speed: your speed minus the traffic
car's, full speed against anything static.

**Stops.** Crazy stop: the car must come to rest with the passenger door inside the bay window. Age is revealed on boarding.
Pass the stop and it's gone (NEXT STOP). Drop-off is the same move at a spending place's bay; every rider going there gets out.

**Points.** Per rider at drop-off: `age_points(age) * group` where `age_points` = 1000 for 70-80, `1000 - 20*(70-age)` below,
`1000 - 50*(age-80)` above, floored at 0, and `group` = 1 / 1.5 / 2 for 1 / 2 / 3 riders dropped together.
Distance: 1 point per metre to start (tune toward a third of a good score). SCORE ticks live with distance; riders land on drop-off.

**Edges.** Full car: nobody boards, radar shows CAR FULL, bay not highlighted. Time up: riders aboard score nothing, results list
them with their lost points. Five legs = four forks, ~36 s per leg; clock exactly 3:00, each track trimmed or faded to end at 0:00.

**Effects.** Designer paints skid smoke and the wreck burst; code draws tyre marks, sparks, boarding fade and the bailout tumble.

## Onchain (decision log)

Reuse `masm/challenge/*` untouched; write one `beats_target` (`masm/games/pub_score.masm`).

- Record game data: seed, song id, rules version, COURSE commitment (the course itself travels as advice, hashed like GQ's answers).
  Rival clients regenerate the course from the seed and refuse records whose commitment doesn't match.
- ANSWER = commitment to the decision log: fork choices, `(event, t_10ms)` for every pickup and drop-off, final distance.
- The script checks: the route is a path through the pyramid; every event lies on that path and each passenger is taken once;
  times increase and every gap is drivable at top speed plus the minimum stop time; all within 3:00; never more than 3 aboard;
  drops only at the rider's spending place; distance fits the clock. Then it recomputes the score and compares to the target.
- It cannot check the driving itself (traffic, crashes, skill): a bot can submit a perfect feasible route. Same hole as GQ;
  the parked referee design applies later if wanted.

## Milestones

### M1: feel (graybox, solo, keyboard + touch)
- [x] Vite + React + TS app (GQ lineage), one canvas game component, DOM HUD → verify: `yarn dev` runs, canvas at 60 fps on desktop and a phone
- [x] Pseudo-3D road: segments, curves, lane dashes, curbs, sidewalks, all from world distance → verify: at 0 km/h everything stops; dashes and curbs never slide against each other
- [x] Car controller: gas, brake, steer, skid when braking hard while steering → verify: test: 0-to-top under 8 s, top-to-stop under 3 s; Gaylord drives it
- [x] Traffic + hazards + bump/wreck classifier → verify: test: closing speed under 60 km/h bumps, above wrecks and ejects riders
- [x] Bays + sidewalk passengers + crazy stop auto-board → verify: test: boards only at rest with the door in the bay, once per passenger; drop banks the group award
- [x] Forks (Y junction, gantry with two names, ghost branch after the choice) + a drop bay at every street start → verify: test: side locks at the decision line and bends the road; screenshots of the Y, gantry, stop, drop
- [x] 3:00 clock, pause on P/Esc and on blur → verify: test: run ends at 3:00 with riders aboard listed as lost; pause stops the step loop
- [ ] Gaylord playtest, tune handling together

### M2: rules + course
- [ ] `rules/vectors.json`: age points, group multiplier, distance, a few full logs with scores (test first) → verify: TS tests read the vectors
- [ ] Seeded course generator (pyramid, districts, pools from venues.json, stops, ranges, rider destinations, traffic, hazards) → verify: same seed gives a byte-identical course
- [ ] Headless run model (top speed, stop cost, street length; the same model the chain's feasibility check uses) → verify: a bot run sizes street length so a good run ends around leg 5, and sets the distance rate near a third of its score
- [ ] Full 5-leg run with gantry signs, seats, drop-offs, ramp → verify: careful vs fast play on one seed both score meaningfully; no district always wins

### M3: art, HUD, audio
- [ ] Integrate the three packages + the next delivery (world-metadata.json crops, arcade atlases with fixed anchors, PUB Pixel) → verify: feet and props stay beyond the curb on straights, both branches and both phone layouts
- [ ] HUD: time, score, speed, radar, seats, gantry signs + phone direction row, callouts, results → verify: matches boards at 1280x960, 390x844, 740x340
- [ ] Splash + menus on `Boomers`, radio select over the 14 level tracks, results on `Wireline Cosmos`, synth SFX (engine, skid, crash, ka-ching) → verify: no autoplay; reduced motion honoured
- [ ] Gaylord playtest on desktop + phone

### M4: onchain scoring
- [ ] Copy `masm/challenge/*` and the `integration` crate from GQ
- [ ] `pub_score.masm` replaying the log, failing tests first: win, loss, broken route, too-fast gap, 4th rider, wrong drop, over 3:00 → verify: `cargo test -p integration --release` green, MASM pinned to `rules/vectors.json`

### M5: challenge flows
- [ ] Copy GQ's `bread.ts`, `notes.ts`, `flow.ts`, hub/boards; own note tag; Gamecoin; record = seed + song → verify: record, shot, settle, collect on testnet via `?local=1` / `?local=2`
- [ ] Gaylord's Bread round on desktop and phone

### M6: ship (on Gaylord's word)
- [ ] Vercel on `guelowrd/pub` (root `web`, cross-origin isolation headers) → verify: live URL plays a full run and a challenge

## Open items (my proposals, confirm or change)

1. Pyramid of 5 legs, 15 streets.
2. Age revealed on boarding, points banked on drop-off.
3. The crazy stop pays in time saved plus a CRAZY STOP! callout, no separate points, so the chain's timing check covers it.
4. Top speed: the brief's 110 km/h feels slow for a driving-first game. I'd start around 200 km/h in M1, with the wreck threshold scaled to it.
5. Three travel lanes plus bays, so there's room to weave and roadworks can close one.
6. No way to kick out a bad pick: the wasted seat is the price.
7. Target band 70-80 fixed for every run (my pick: fixed, one rule everyone learns).
8. 32 new characters (48 total).
9. Songs: in `temp/` (mp3, ~190 kbps, ~4.3 MB each; level tracks 179.7-181 s, fade at 0:00). Radio cards show title + a mood
   deduced from the title (list in `docs/designer-brief.md`). Display "Omotesando" (no Ō glyph in PUB Pixel);
   "Midnight Pursuit" renamed "Midnight Chase" (file too). Assumed his to ship, like GQ's tracks.
10. SFX synthesized in code (WebAudio), no audio files.
12. Nobody wants the district they're picked up in, so every delivery crosses a fork (and street 1 never drops).
13. Pickup venues per district: 2 of the 8 each, set in M2 against the pools so no district always wins.
14. Course map in the HUD (review 2026-10-15): the pyramid with district colours and your position. Without it a fork is a
    coin flip for riders whose place isn't on the next sign; with it the game has a planning layer, like reading OutRun's map live.
15. A record is a known course: the rival regenerates it from the seed and can practise it before shooting (SAME RUN does the
    same for the champion). Time-attack format, same as GQ's known city list. Fine by me; flag it if you want blind shots.
16. Course depth 7 legs, drop bay at the start of each street, wreck on closing speed (all in the rules above).

## Review

### M1 (2026-10-15)
Built in `web/`: `src/game/sim.ts` (state + step, pure), `src/game/course.ts` (seeded streets, curves, stops, hazards,
forks, traffic), `src/game/render.ts` (pseudo-3D canvas), `src/App.tsx` (loop, keys, touch pad, DOM HUD, overlays).
7 tests, typecheck and build green. Verified in Chrome by teleporting the car (`window.pub` dev hook) since automated
tabs throttle requestAnimationFrame: the Y fork, gantry, stop + boarding callout, drop bay, traffic all draw.
Starting numbers: top 200 km/h, 0-200 in ~6 s, brake 28 m/s², wreck above 60 km/h closing speed, streets 1200 m,
fork 120 m trunk + 200 m bend, distance 0.5 pt/m. Not done: Gaylord's playtest and the handling tune.
Skipped on purpose: pyramid, venue pools and characters (M2), any art (M3), sound.
Feel pass (same day): lamp posts every 40 m, hills, 4:3 view, car bob, radar from 250 m, boarding anywhere in the bay.
Bot run (`bot.test.ts`, report in `web/bot-run.txt`): 5.1 km, 4 streets, 10 picks, 1 drop, 10 wrecks. Wrecks are the
thing to watch in the playtest: rear-ending 100 km/h traffic at 200 km/h is a wreck, and a wreck empties the car.
Candidates if humans wreck as much: raise the wreck threshold, slow the car, thin traffic, or make traffic hold lanes.
Playtest batch 2 (same day): top 220, traffic avoids hazards and slower cars like the player, curve push 75.
Reverse: brake held past a standstill backs up at 20 km/h (REV), gas or letting go stops it. Reversing earns no distance;
backing into a car behind stops you. Gaylord asked for it: the reflex after a missed stop is to keep braking.
