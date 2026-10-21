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
| music | in `temp/`: `Omotesandō (original tempo)` loops on splash and menus (decided 2026-10-15 evening, `Boomers` parked), `Wireline Cosmos` loops on results and challenge screens (record, claim), the other 13 are level tracks for radio select (all ~3:00, Omotesando is off the dial); the song is the run |
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
- [x] `rules/vectors.json`: age points, group multiplier, distance, a few full logs with scores (test first) → verify: TS tests read the vectors
- [x] Seeded course generator (pyramid, districts, pools from venues.json, stops, ranges, rider destinations, traffic, hazards) → verify: same seed gives a byte-identical course
- [x] Headless run model (top speed, stop cost, street length; the same model the chain's feasibility check uses) → verify: a bot run sizes street length so a good run ends around leg 5, and sets the distance rate near a third of its score
- [x] Full 5-leg run with gantry signs, seats, drop-offs, ramp → verify: careful vs fast play on one seed both score meaningfully; no district always wins (course map in the HUD is M3)

### M3: art, HUD, audio
- [x] World art: v3/v4 sheets drawn at fixed anchors (hero poses, brake, spin; 6 traffic kinds with yaw + brake; hazards; lamps, district trees, venues, shelters, 48 people; destination buildings with the door beside the bay + 3 props each; drop markings + icon poles; skid smoke, wreck burst; skyline parallax) → verify: screenshots at a stop and a drop bay, no console errors
- [x] Data v4: 48 characters, 12 pools (spending places have a pickup stop 110 m into the street, stop 0), radio station concepts (no audio) → verify: course tests pass, vectors regenerated
- [x] HUD: time, score, speed, radar, seats, gantry signs + phone direction row, callouts, results → verify: matches the v4 boards at 1280x960 (screenshots); phone layouts still to check
- [x] Splash + menus on `Omotesandō (original tempo)`, radio select over the 13 level tracks, results on `Wireline Cosmos`, synth SFX (engine, skid, crash, ka-ching) → verify: no autoplay (music starts on the splash click), reduced motion keeps the start prompt steady; songs in `web/public/music` (66 MB, slug names), M toggles sound
- [x] Handoff 05 (`~/Code/pub/Pick-Up-Boomers-Radio-and-Districts`, same night): the real car radio (`web/src/Radio.tsx`, layers from radio-anchors.json, 3 layouts, needle on the painted detents, LCD title/mood/number in Boomer LCD, VU from a stereo analyser, volume knob with wheel + up/down, press mutes, ignition key = DRIVE; tuning plays the station, the menu track plays until the first tune), Boomer GT for words and Boomer LCD for every number, the chrome CLICK TO START image, district skylines behind a sky the song colours (`SKY` in stations.ts), fillers both sides between venues dimmed 0.65, painted portals per destination district fading as you reach them, light heads on the poles, asphalt tinted per district → verify: screenshots desktop + portrait, no console errors. 5 `.partial` leftovers in the package again, ignored
- [x] Tunnel kit (`~/Code/pub/Pick-Up-Boomers-Tunnel-Kit`): ONE shared two-mouth structure per fork chosen by the street you're on (harbour causeway, tower podium, highway overpass, wooded ridge; mouth anchors 664/1384 of 2048, scale = mouth spacing / 720 px; trims tinted per destination with cached masks), wall + ceiling materials as canvas patterns per segment (8 m period, wall band over the lower 6 m), strip lens glowing in the destination colour with the beat, light: 0.1 inside + mouth and exit spill + headlights 0.8 s after entering (brightness filter on sprites and surfaces, road colours mixed to dark), headlight cookies on the road, 0.6 s white bloom at the exit. TUN_H 12 to match the painted arches. Single portal faces dropped → verify: screenshots at the mouth, inside, after the exit
- [x] Floating decor (Gaylord): the ground was one flat fill, so on a hill crest anything beside the sidewalk stood over nothing; the ground is now a full-width band per segment that follows the hills → verify: crest and dip screenshots
- [~] Beat-reactive neon: the tunnel strips pulse with the music (setBeat from the analyser); curbs, lamps and sun stripes still to do
- [ ] Decor variety (Gaylord, later): more prop kinds per district, varied spacing (asked of the designer in docs/designer-brief-next.md)
- [x] Attract mode on the splash (`web/src/attract.ts`): the painted title scene + splash car, a rider (age 50+) walks down the right sidewalk to the door, boards, PULL IN / CRAZY STOP! / AGE + points callouts, tail lights breathe; 7 s per rider → verify: screenshots at two moments
- [x] Tunnels 200 m (exit 100 m into the street, drop bay at 130, destination stop at 190, venue stops from 300), headlights 0.35 s after the mouth. Vectors regenerated
- [x] Top speed 299 with tapered power (220 under 8 s, 260 at 12 s), steering lag growing with speed, turn scrub, curve push scaled from 220
- [x] Course map in the HUD (open item 14): built, then REMOVED on Gaylord's call (gives away too much). Forks are read from the gantry only
- [x] Portrait phone layout: scene on top, seat strip + radar below, pad under; radio and results fixed to the viewport → verify: 420x900 window screenshots. Landscape 740x340 not yet checked
- [ ] Gaylord playtest on desktop + phone

### M4: onchain scoring
- [x] Copy `masm/challenge/*` and the `integration` crate from GQ (storage, scripts, helpers, funding, auth args, gamecoin bin; GQ's quiz/rules replaced by `game.rs`)
- [x] `pub_score.masm` replaying the log: win, loss, broken route, too-fast gap, stop twice, 4th rider, wrong drop, nobody aboard, over 3:00, time backwards, distance → verify: `cargo test -p integration --test pub_test` green (4 tests, 52 s), MASM pinned to `rules/vectors.json` (4 runs: score - 1 settles, score is refused); `web/public/scripts/{record,shot}.bin` built by `cargo run --bin build_scripts`

### M5: challenge flows
- [x] Copy GQ's `bread.ts`, `notes.ts`, `flow.ts`, hub/boards; own note tag; Gamecoin; record = seed + song → verify: record, shot, settle, collect on testnet via `?local=1` / `?local=2` (2026-10-16: record posted by DKQ, shot by LFH, lost on the road, collected by DKQ after the deadline; all four moves seen on chain)
- [x] The head unit (menu kit) as the whole menu: RADIO, RECORDS, POST, HISTORY, SCORES, WALLET, AUDIO, SYSTEM
- [ ] Gaylord's Bread round on desktop and phone

### M6: ship (on Gaylord's word)
- [x] Vercel on `guelowrd/pub` (root `web`, cross-origin isolation headers): project `pub`, live at https://pub-swart.vercel.app, every push to main deploys (2026-10-17) → still to verify: a full run and a challenge on the live URL

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
13. Pickup venues per district (set in M2, expected rider points per pair from the pools in brackets): Downtown market + garage
    (630), Waterfront aquagym + arcade (610), Casino Strip bar + bingo (737), Golf Hills nursing home + school (574).
    Spread 1.28x, the test caps it at 1.35x.
14. Course map in the HUD: built in M3, removed the same night on Gaylord's call (it gave away too much). The fork is read
    from the gantry signs only.
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
Curbs and lights (same day, Gaylord's ask): curb drag per district (CURB: downtown 3/s, casino 2, waterfront 1.5, golf 1).
Traffic lights per street (LIGHTS: downtown 3, casino 2, waterfront 0, golf 0), red 2 s / green 10 s, random phase.
A red is a stopped blocker in every lane, so traffic queues at it and pulls away at 3 m/s² on green; you thread the
queue or wait. Traffic now brakes by stopping distance (10 m/s² plus 8 m) instead of a flat 35 m. The player gets no
penalty for running a red, only the queue itself. Bot: 6.6 km, 12 picks, 5 wrecks (full throttle into queues).

### M2 (2026-10-15)
Course: `pyramid(seed)` builds all 7 legs (28 streets) up front with one rng, so the course is a pure function of the seed
(test: same seed, same JSON). Each street: district (differs from both parents and its leg neighbour), 3-5 stops at the
district's two venues, riders from venues.json pools by weight with the characters' fixed ages, honest range + class,
destination never the pickup district, hazards, lights, curves, hills. Streets are placed on the road as you turn into them;
past leg 7 the road runs on empty (no fork). Decision log is now typed events in 10 ms ticks: fork (side), pick (stop index
on the street), drop, wreck. `rules.ts` replays a log on a course to the score and rejects broken logs (stop twice, 4th
rider, drop on street 1, time backwards, after 3:00, fork past the last leg). `rules/vectors.json` pins constants, age
cases and 4 bot runs (seeds 7, 8, careful and fast); regenerate with `GEN_VECTORS=1 yarn vitest run bot` in `web/`.
Sizing kept: STREET 1200, RATE 0.5. Bot: careful ends on leg 5 on both seeds (7.4 km / 6.1 km, scores 4,099 and 11,733,
distance ~3,000-3,700 points, so a third of a good run), fast reaches leg 6 with 8-11 wrecks (~4,300). Gaylord's playtest
on the pyramid is the open item; the course map in the HUD moves to M3.

### M3 (2026-10-15, evening)
World art, HUD, splash, radio + music, SFX, course map and the portrait layout are in (commits eb6dbaa..). Art pipeline:
`art.ts` holds one Sheet per designer atlas (cell size, columns, fixed anchor, pixels per metre from the metadata's visible
bounds and world sizes); `render.ts` draws whole cells at the anchor, props and buildings with their own ppm. The 48 people
come from three sheets (a: 256x384 cells, b/c: 512x512). Audio: `audio.ts`, one audio element for music, WebAudio for
engine/skid/events; songs are `web/public/music/<slug>.mp3` (66 MB, pushed; `git config http.postBuffer` raised for it).
Hot reload gotcha: the frame loop closes over `draw`, so render.ts changes need a page reload to show.
Left for M3: landscape phone check, Gaylord's playtest on desktop + phone, the designer's .partial cleanup is done upstream.
Playtest 3 (same night): tunnels between areas (from where the branches run straight to 30 m into the next street, one
mouth per branch with the district's trim colour, lit ceiling inside, walls climb out of view only when the camera is in);
traffic spawns beyond the draw distance (760-1160 m) so cars come into view instead of popping in; the designer's chrome
CLICK TO START lettering (components/start-prompt.css) replaces the plain blink. Steering poses kept as drawn: nose left
shows the right flank, OutRun's convention; Gaylord read it as turning right, flip is one line in render.ts if he wants.

### M4 (2026-10-16, night)
Chain data: game data = SEED(4) | song, rules version, 0, 0 | COURSE_COMMIT(4); the course (28 streets x 8 felts:
district*16+count, then stops as dest<<24 | points<<12 | z/5) and the log ([n, distance, events as kind<<24 | arg<<16 | t])
travel in the advice map under their commitments (`note::compute_storage_commitment`, same as GQ's answers). The script
replays with the car's position: fork at the decision line, pick at the bay's middle, drop at the bay, dwell 1.2 s / 1 s,
top speed 0.83 m per tick, 60 m of reversing allowed, distance >= last event. `rules.ts` mirrors those checks so the sim,
the TypeScript replay and MASM agree on the vectors. One bug on the way: a u32gte operand order (the reverse check) refused
every second event; the error-code lookup (MasmError::from_static_str(msg).code()) found it in one run.
Left: M5 (the four transactions in the web app, GQ's bread.ts/notes.ts/flow.ts, Gamecoin from gq/gamecoin.json, own tag
0x50420001), wired to the designer's head unit when it lands.

### Playtest 4 fixes (2026-10-16, night)
Gantry = two green plates per fork (arrow out, icon in, name sized to fit, district colour band); tunnel strip is geometry
(the textured one stepped at every segment seam), wall texture pinned along the road edge, darkness filled behind the
painted arches (they are wider than the tunnel box). Wrecks knock 15 km/h off the run's top speed, floor 220. Menu music
on the splash (plays once the browser allows sound). Invisible tunnel traffic, root cause: a sprite within 0.3 m of the
camera draws ~10,000 px wide and grew the darkening scratch canvas past Chrome's 32,767 px limit, after which every dark
sprite (tunnel traffic, dimmed fillers) drew nothing for the rest of the session; sprites closer than 1.5 m to the camera
are now culled, and traffic keeps a 0.6 light floor in tunnels so its lights show before the headlights reach it.

### M5 (2026-10-16, small hours)
Chain layer = GeoQuizz's, copied into `web/src/chain/` (notes, chain, bread, flow, hub, localWallet, funding, gamecoin,
providers) with the quiz parts cut, tag 0x50420001, Gamecoin only, no v1 roots. `chain/game.ts` is the game: data =
SEED(4) | song, version, 0, 0 | course commitment (4); the claim's note argument is the log's commitment, the course and
the log travel under their commitments (Poseidon2.hashElements hashes exactly as `note::compute_storage_commitment`;
`game.test.ts` pins both to the Rust-printed hexes). `useChain.ts` is one hook: wallet (Bread, or `?local=1|2`), height
and notes every 15 s, balance, and the four moves through GQ's `run` (wallet, then wait until the node shows the effect;
Try again looks first whether the attempt landed). `ChainHost.tsx` is loaded lazily and publishes the hook's object to
App: the SDK awaits its 20 MB wasm at import, the splash never waits for it. The head unit (`HeadUnit.tsx`, geometry
in `game/data/headunit.json` trimmed from the kit's metadata) replaced the radio screen: presets 1-6 are the modes, MODE
cycles, left arrows move or tune, right arrows back/select, AUTO is the lower LCD's action (DRIVE, SHOT, POST, COLLECT,
CONNECT, GET GC, TRY AGAIN), keys 1-6, arrows, Enter, Esc, m. Text sits on the kit's baselines: with line-height 1 both
fonts put the baseline 0.86 em under the span's top (ascent 0.96, descent 0.24). A free run ends on SAME RUN / NEW RUN /
POST IT (head unit on POST: SCORE, PRIZE 1/2/5/10 GC on the arrows, COURSE, STATION; then SHARE ON X, COPY LINK); a shot
settles itself on the results screen (TRY AGAIN, DRIVE AGAIN while the shot is open, MENU). `?record=<id>` opens the
head unit on that record's review. Also from the kit: the song's car paint (stations.ts CAR, the hero sheets multiplied
once per song), the painted gantry (frame 26 m wide, plates at the mounts, trims, name fitted, badge with the count),
32 street props (`art.ts DECOR`, every 55 m, clear of bays and forks), the loading screen with the 14-segment bed, the
icons, manifest and the share template as the link preview. Vitest runs in jsdom with the Miden Vite plugin left out
(the plugin points the SDK at its browser build, whose wasm loads by fetch; node reads it from disk). `web/vercel.json`
is GQ's (isolation headers). End to end on testnet with the two local wallets: DKQ posted 2028 points (1 GC prize),
LFH shot it, drove 2005 (a loss: nothing signed, DRIVE AGAIN offered while the shot was open), and DKQ collected the
lost Gamecoin from HISTORY once the deadline plus CLAIM_FUZZ had passed. Skipped: the kit's share card as a downloadable image (the template is the link preview),
other boards than best records, a code paste box (links work), SYSTEM settings beyond version and network.
Not verified: the head unit's portrait and landscape faces on a real phone (Chrome refuses to resize its window here; the
geometry is the kit's, the desktop face is right), Bread itself (the local wallets sign the same requests). Testnet blocks
ran slower than 3 s tonight: the 6-minute shot window outlived the drive, so SHOT_WINDOW_BLOCKS is fine; a rival whose
tab is hidden (Chrome throttles the frame loop to a crawl) can still miss it.

### Visual update (2026-10-16, morning)
The designer's PUB-Visual-Update pack, Gaylord's picks: menu B NIGHT SHIFT, radar B with the reticle as a POSITION map.
Fonts: Chakra Petch SemiBold for words and legends, Share Tech Mono for lists and every number (public/fonts, the Boomer
faces are gone). Head unit rebuilt on the kit's menu.json geometry: blank face + the four-state key art (rest / hover /
pressed / disabled; hover doubles as lit for the mode's preset), rows in Share Tech Mono on the kit's baselines, one
selection rectangle, the lower LCD with the station index, the 14-slot band and VOL; no mood line. The kit's action key
says DRIVE, so other modes draw their own key (SHOT, POST, COLLECT, CONNECT, GET GC, TRY AGAIN) in the same style.
Text sits on baselines through measured font metrics (`baselineEm`). Radar: the B shell at 400 x 248 inside the rail,
the rider's portrait downsampled to 48 samples and dithered to phosphor green (sRGB luminance, black 0.13 / white 0.7,
4 x 4 Bayer at 0.45), the reticle with a blip on the pickup's curb side that climbs with the distance (centre = here,
top = 250 m), AGE RANGE under it; search and CAR FULL use the kit's baked shells, drop-off keeps the reticle with
DROP OFF. District materials: the asphalt tile over the road and the verge tile over the sidewalks, world-space UVs
pinned per 5 m segment, 0.3 / 0.45 strength fading out over 70 segments; a soft contact shadow under every standing
sprite. Car paint is body-only now: the silver body (low saturation, lum above 0.22) takes the song's colour with its
own shading, lamps, glass, tyres and neon reflections untouched; 13 of the kit's 14 families mapped in stations.ts
(silver unused). Gotcha found: `.overlay button` outranked `.hit`, so the key hit areas painted navy over the key art.
Not done: the optional radar sweep layer, hover states on mouse-over (hover art marks the lit key instead), the share
card, the kit's A and C menus (B is the only fully exported one).

### Menu fix + results post (2026-10-16, morning)
Gaylord: the radio is a jukebox (songs, records to shoot, scores, settings), not the post-game menu. Posting moved to the
results screen (POST IT, 1 GC like GQ, SHARE ON X, COPY LINK); the head unit's presets are RADIO, RECORDS, SCORES,
HISTORY, WALLET, SYSTEM. The RADIO list follows the station (keys, click, wheel). PUB-Menu-Fix integrated: label-free
action key with the runtime label on the kit's baseline, the selection layer, 13 ticks, landscape 16 px rows. Screens
of every state in docs/screens/ (18 shots), the brief for the designer in docs/designer-brief-3.md. Road tiles 4 m /
verge 3 m (8 m was a blur at the bottom of the screen).

### Fix list from the screen tour (2026-10-16, morning)
Done in code: the lower LCD is the radio in every mode (index, band, VOL, song); POWER = off to the splash; FREQ/BAND seeks
a random station; SCORES one row per player; SYSTEM RESET BEST row; the radar scans inside tunnels; the HUD hides under
the results; the radar tried the bottom right corner and went back under the seats on Gaylord's word; MILLENNIALS; bot
runs from the dev hook never set the best. For the designer (docs/designer-brief-3.md): the results screen, the rail,
HISTORY icons, the pause overlay, the radar DROP OFF and reveal states, the share card, the splash ribbon, phone shots.

Correction (2026-10-16): the prize picker was mine, never asked for; one stake and one prize of 1 GC, as in GQ.

2026-10-16 later: wheel steps every 80 px; DRIVE spans the back/select keys (desktop, portrait; Enter/Esc/rows do their job); Bread asks before sharing assets, so the balance is read on request only (WALLET: BALANCE row, SELECT TO READ), the local wallet still reads by itself. The second Bread popup after a post was my balance refresh.

### Results and HUD kit (2026-10-16, midday)
The designer's PUB-Results-and-HUD pack, not followed blindly. Results: the kit's frame and wells per layout (results.json
trimmed from its metadata), the padded score, BEST, three stats, STILL ON BOARD rows, the post well with its states
(POST YOUR RECORD + the terms line / CONNECT WALLET / NEED GC / CHECK WALLET / GETTING READY / POSTING / the error with
TRY AGAIN / RECORD POSTED with SHARE ON X, COPY LINK and SAVE CARD), the shot verdict (RECORD BEATEN / RECORD HELD /
CHECKING RESULT), SAME RUN / NEW RUN or TRY AGAIN, NEW RUN / MENU; the kit's keys in their four states with the label on
its baseline; the scene frozen under a #060b16 dim at 0.9. The results screen scales from the kit's canvas like the head
unit (shared board.ts). HUD: the kit's plates for TIME, SCORE, SPEED (no KM/H), the seats as the thin strip top centre
(TO BANK, FULL, portrait + age + destination line icon, EMPTY); the radar at the kit's 210 x 128 but kept on the right
under the score, where the rail was (Gaylord: the bottom right was worse), with its five states on the kit's geometry
(target, DROP OFF with the destination icon, the 2 s reveal, SCAN with two rings, CAR FULL). HISTORY rows: crown and
target icons by kind, the state word in the kit's colours (OPEN, IN PLAY, COLLECT, BEATEN, DEFENDED, TAKEN BACK, WON,
LOST). Pause: the kit's card over the dim. Share card at runtime (share.ts: background, title, score, station, up to
three riders cover-cropped, frame; SAVE CARD downloads the PNG). Splash: the kit's CLICK TO START layer was tried and reverted the same day (Gaylord liked the earlier
chrome one better; it stays, 1.6 s blink), the scrolling rules ribbon restyled to the kit's strip (smoked glass, hairline, Chakra 17). Render fixes from the
audit: the nearest road slice is pinned to the near plane (the 0.3 m clamp blew its tile into a blur and cut the lane
lines at a hard edge); the fork structure stays solid until driven through (the fade let the outside show through the
arches); verge tiles 2.5 m at 0.3. Kept from before, against the kit: the radar's place, the terms line in the post
well, the nine-rule scrolling ribbon. Phone layouts (portrait plates doubled, strip + radar under the scene) are still
unverified on a device.

Corrections (2026-10-16, afternoon): Gaylord liked the earlier CLICK TO START better, and the first one better still: the
CSS chrome lettering with the glint from commit 49d9427 is back (Chakra Petch now, the pixel font is gone), the kit's layer
and the PNG are out. He did not like the HUD changes either: the pre-kit HUD is back whole (cyan panels with KM/H, the
seats panel with portraits, age and points in the right rail, the 400 x 248 radar under it); the kit's plates, seats strip
and 210 x 128 radar are out. Results screen, pause card, HISTORY icons and the share card stay.

2026-10-16 afternoon, from Gaylord's screenshots: the near-plane fix banded the road on hills (the pinned slice took the road
height at its own start, now the near plane's); every score shows US thousands separators (results, BEST, HUD, head unit
lists, share card; no more zero padding); the results' middle well lists every rider picked up (portrait, AGE, points),
the ones still aboard in pink with ON BOARD and a note at the right (N STILL ON BOARD, X LOST); the posting terms are his
three lines (RIVALS GOTTA PAY TO CHALLENGE YOUR SCORE / IF THEY BEAT IT, THEY TAKE YOUR GAMECOIN / BUT IF THEY DON'T,
THEIR GAMECOIN IS YOURS!). Open: the TO BANK wording (FARE / ON BOARD / METER / AT STAKE offered), the splash ribbon copy.
Same afternoon, second screenshot: "TIME IS UP, YOU SCORED" with POINTS small after the score, DISTANCE POINTS (the value
was points all along, the "m" was wrong), "YOUR BEST: 14,236", riders still aboard have their points struck through
(the player never scored them) with ON BOARD after, the right-hand note is gone, POST IT stands as tall as the three
lines beside it (the key follows the status height on desktop).
Ribbon copy is Gaylord's (fd80084). TO BANK is now BOOMER METER (seats header; the radar reveal says "+80 ON THE METER").

### High-speed visual test (2026-10-16, afternoon)
Gaylord: "weird bugs while driving higher speed", mostly the road. Driven with a dev-console autopilot (v pinned to the
cap, x to the centre, hazards hit, traffic nudged out of the lane) and a per-frame recorder on the canvas: curb edges by
colour on three rows, the pixel under the car, the camera's road height, the render's own near geometry re-derived.
Two root causes, both fixed in render.ts:
- Hills: the near plane used the camera's absolute height, so on every hill the nearest slice started too far out and
  the ground colour showed under the car (the road "ended" in a flat line halfway up the screen on an 8 m top; below a
  2.2 m dip the plane went negative and the first slice projected to nonsense). Now the plane is 2.2 m under the camera,
  found on a slope by three fixed-point rounds (roadY helper). 1,142 frames incl. 118 on hills: no bare ground.
- Curves: the OutRun shortcut (x = 0, dx = -c0 * frac) shifts the whole road by one segment's curvature at every segment
  start. At 299 km/h that is a 16 Hz sawtooth: at the 0.9 h row the near curb slid 3 to 5 px for three frames then
  jumped back 11 px (8 px at 0.75 h). Now the centre line integrates curvature into heading and heading into offset,
  exact at the segment starts, with the camera's own offset and heading inside its segment taken out; the branch offsets
  in course.ts integrate the same way. Residual: about 2 px of chord wobble at the nearest row (5 m slices drawn straight).
Looked clean at top speed after: flat, hill top (+2.7 m), dip (-1.3 m), tunnel exit, fork arch, stop bay. Unchanged and
worth a word from Gaylord: the asphalt tile (4 m) and verge tile (2.5 m) repeat faster than the frame rate at speed
(1.4 m per frame at 299), so they strobe; a speed fade on the material alpha would calm it.

### Designer packs PUB-Tall-Action-Keys + PUB-Stage-TV (2026-10-16, 17:00)
- Tall action keys: eight faces (desktop 184 x 122, portrait 92 x 116, rest/hover/pressed/disabled) copied over
  art/menu/{desktop,portrait}/action-blank-*.png. Same rects as the merged key, label maths unchanged (their baseline
  73.285 at size 35.1 = centre + 0.35 em, what the code already does). Verified on screen: desktop + 390 x 844 iframe.
- Portrait bug found on the way: the LCD (152 wide) drew VOL 70% and the song title on one line and they overlapped
  (VOL ends at 175, title starts at 152 in a 390 window). Portrait now drops the title line; the list names it.
- PUB-Stage-TV is a proposal, not applied: a CRT above a recomposed radio showing the stage (song = stage) with
  district / time / weather; 12 preview paintings (waterfront, downtown, casino strip, golf hills x midday, sunset,
  rainy night); only BITTERSWEET SUNSET assigned (waterfront, sunset, clear); the other 12 songs open. Gaylord to
  decide: adopt the TV menu, the song assignments, whether the world renderer gets time-of-day / rain (big: the
  current world art is night-only). Decisions pending.

### Gaylord's round (2026-10-16, 17:15): ribbon, HUD fonts, traffic, Stage TV go
- Ribbon: RIDERS -> PASSENGERS (three rules).
- HUD: "the font is now minuscule". The sizes never changed; the visual update (2373550) swapped Boomer GT / Boomer
  LCD (pixel fonts) for Chakra Petch / Share Tech Mono, which read far smaller at the same size. The two woffs are
  restored from that commit and the .hud subtree uses them again (radar B keeps its own fonts, it was drawn with them).
- Traffic: TRAFFIC per district (downtown +3, casino +3) added to the cars kept ahead; the street under the car decides.
- Stage TV: adopted. The designer's table of 13 assignments is the stage list. Brief 5 (docs/designer-brief-5.md)
  asks for the three missing night/clear previews (downtown, waterfront, golf hills) and a list board inside the TV.

### Stage TV built (2026-10-16, 18:00)
- Head unit rewritten on PUB-Stage-TV: the TV (bezel + glass over the painting, captions on top) above the recomposed
  radio, geometry from component-contracts.json -> game/data/menu.json (python one-off, plus my own tag / count / list /
  conditions geometry under `tv`, to be replaced when the designer's list board lands). Faces: rest / pressed / lit /
  disabled, the action key alone has hover. No back/select keys on desktop and portrait (Enter, Esc, rows); landscape keeps them.
- Song = stage: stations.ts holds district, time, rain per song (the designer's table). The TV shows the district's
  painting at its hour; night + clear is not painted yet, those three stages show the rainy night of the district
  (previewOf, ponytail note) until the designer delivers. All 13 paintings preload on mount; TUNING until the current one is in.
- The course starts in the song's district: pyramid(seed, song), newSim(seed, song), Sim.song, courseFelts / pubAnswer /
  settle carry the song. RULES_VERSION 2: version 1 records grew another course and are no longer listed (testnet only).
  rules/vectors.json regenerated (GEN_VECTORS=1, traffic change moved the bot's logs too); LOG_COMMIT repinned in
  game.test.ts; `cargo test -p integration --test pub_test` 4 passed (50 s). vitest 64 passed.
- Verified on screen: desktop RADIO (three stages), SYSTEM and RECORDS lists in the TV, portrait and landscape in iframes.
- Not done, by design: the 120 ms scan transition on tune (plain swap), the vignette layer, daylight / rain in the driving
  scene (engine test first, brief 5 item 3).
- Results (Gaylord, 18:20): PASSENGERS on the results screen (stats, well title); passengers who bailed in a wreck were
  gone from the seats with no trace, so the recap scored them like deliveries. Sim keeps `bailed`; the recap crosses
  them out in pink with BAILED, like ON BOARD at time-up. HUD callout says WRECK! PASSENGERS BAILED. Test extended.
- Dial order (Gaylord, 18:30): NOCTURNAL RUN, SYNTHWAVE ENGINE, ABANDONED FACTORY, MIDNIGHT CHASE ("Midnight Pursuit"),
  OUTRUN PULSE, VECTOR WORLD, PICKUP TRUCK, DARK HORSE, BITTERSWEET SUNSET, NEON PURSUIT, ORANGE HORIZON, NIGHT CRUISE,
  PICK UP OR CRUSH UP. Song 0 now starts in golf hills, so rules/vectors.json regenerated and both commitments repinned.
- Results (Gaylord, 18:50): the desktop post key fills the post well top to bottom, 12 px padding (well [459, 132] in
  results.json, measured on wells.png), label centred; the 224 x 58 plate is stretched, a tall one asked in brief 5.
- Tunnel crashes "out of nowhere" (Gaylord, 19:10): at the decision line the sim moves the player's x by W into the
  branch's frame but left the traffic in trunk coordinates, so every car ahead jumped 5.25 m sideways in the player's
  view, right at the tunnel mouth (zDecide + 100). Now the cars ahead move with the frame: the far-side one is dropped
  (it went the other way), the rest snap to the nearest branch lane and drift there at 3 m/s. Test in sim.test.ts.
  Live check with the autopilot (v pinned, x free): max per-frame relative jump 0.67 m through a fork at 299 km/h.
  Note: pinning x in the autopilot undoes the frame shift and fakes a 5.25 m jump; measure c.x - s.x with x free.

### Designer add-ons in (2026-10-16, 19:40): night previews, TV lists, checked set
- PUB-Stage-Previews-Checked 2: all 13 CRT previews in the dial order, incl. the three clear nights and a repainted
  ABANDONED FACTORY (industrial downtown, distinct from MIDNIGHT CHASE). Copied over art/stage; the rainy fallback is gone.
- PUB-Stage-TV-Night-and-Lists: list geometry (`tv.list` in menu.json from their contracts: title, page count, six
  rows, columns number / name / score (x = right edge) / state / icon, selection rects) + display.png and selection.png
  per layout. Rows are now column cells (num, name, score, state, value, icon). RECORDS: n, champion, score, stage,
  crown; review gains TIME LEFT. HISTORY: title, score, state, kind icon. SCORES: n, name, score. Settings: label / value.
- Gaylord: DON'T DRINK & DRIVE leads the ribbon; the menu no longer previews the song (Omotesando stays until DRIVE).
- Screens 02 and 03 refreshed. Verified desktop RADIO / RECORDS / SYSTEM and portrait + landscape iframes.

### Gaylord's screenshots (2026-10-16, 18:07 to 18:19)
- Seats header: 14 px (was 16), FULL in pink, blinking, on the right or on its own line under the meter when the
  meter is wide (flex-wrap). "BOOMER METER 2,800" + FULL did not fit 205 px at 16 or 14.
- Junction road bug: just after the choice the camera still sees slices before the decision line; they were drawn as
  the main road in the branch's frame (a road width off, curbs cutting across both branches for a few frames). Now a
  `widening()` draws the trunk at -side * W in that case. Second part ("white lines don't fit"): the widening trunk was
  one bare plane with the two centre dashes, then six lanes and inner curbs started at the line. Now the two branches'
  lane dashes fan out from the trunk's across the widening and the inner curbs begin at the gore.
- Tunnel mouth see-through: the arch opening is wider than the tunnel section, sky showed in the ring between them.
  tunnel() fills that ring dark (evenodd) at the mouth segment before the walls; the portal's stone covers its outer edge.
- Passenger order on the results screen: pickup order (s.stops order), ON BOARD / BAILED ones stay where they were
  picked up. Gaylord asked; answered, not changed.
- Tunnel entry "black then light" (Gaylord, 19:50): two causes. The headlights were a step 0.35 s after the mouth and
  the mouth fade ran over 18 m; now a 0.15 to 0.65 s ramp (hl) on both the light and the glow, and a 40 m fade. And my
  mouth ring (17b0a2d): the even-odd box reached the bottom of the screen once the mouth was close and the cut-out
  stopped holding, so the whole view went the ring's colour for a few frames. Now three strips around the section,
  skipped under 20 m. Measured under the car at 90 km/h: 55 -> 38 -> 53 over 9 m, largest frame-to-frame step 16 (was 39).
- TV glass over everything (Gaylord, 20:05): the captions and lists were drawn above the glass; the glass img is now
  the last child of the TV, so scanlines and phosphor cover the text too (the designer's note said the same).
- Drop-off fronts in the bay (Gaylord, 20:15): the buildings atlas is painted edge to edge and the sprite was centred,
  so the casino's front began 6 m from the road centre (in the bay) and the cruise terminal reached the road edge.
  BUILDING now holds the first painted column of each ground floor (measured: 63 / 40 / 40 / 40) and the renderer
  stands the front 0.8 m inside the sidewalk's far edge. Checked casino and cruise at 40 m and 12 m.
- Mute (Gaylord, 20:25): the effects bus (engine, skid, thuds, pickups) was created on the first gesture with gain 1,
  so a mute set before that (the m key on the splash) silenced the music only. The bus now starts at the mute state.
  Dev hook `window.pub.level()` reads it; checked 0 while driving muted, 1 after unmute.
- Fork look (Gaylord, 20:40, "the two paths could be cleaner"; chose 1 + 2 of my three): (1) the trunk's two dashes
  run straight to the split, a hatched gore (continuous pavement, one diagonal stroke per slice) fills the first 7 m
  of gap, the branches' inner edges are plain white lines, pink stays on the outer curbs; (2) the branches sweep in an
  S over the first 100 m (course.ts, MOUTHS = 31.5 keeps the portal scale) and run parallel into the bores instead of
  kinking at the line and diverging forever. Option 3 (a stone median in the wedge) not built.
- Fork, third pass (Gaylord, 21:00, "symmetrical, nothing that changes from one frame to the other"): the jump was the
  frame switch at the decision line (the sim re-centred the world on the chosen branch and bent the axis with f.k; the
  before and after pictures were drawn by different code and never matched). Now the axis stays the trunk's through the
  split: both branches are always drawn at ± off from it (branchX), the gore between, both bores until you are in
  yours; you steer into your branch (edges() follow it); the frame shifts onto the bore at its MOUTH, where the bore is
  straight, a pure translation (two frames either side are identical). Traffic through the sweep follows its branch
  (Traffic.branch, lane slides with off), spawns past the split land on a branch, and the mouth shift carries the cars
  along and drops the other bore's. A jump past the mouth (tests, console) counts as already shifted. Fork.k gone.
  Checked: frames at -30, -0.5, +0.5 (line), mouth-45, mouth-0.5, mouth+0.5; 763 car-frames in the sweep, 0 in the median.

### Audit while the designer works (2026-10-16, 21:30)
- Phone pass (no device, 390 x 844 and 740 x 340 iframes): the overlays were `absolute` inside the 4:3 scene box,
  so on landscape phones the results screen and the menu were clipped to 448 of 740 px. Overlays are `fixed` on
  every layout and board.ts centres each screen in the window (left/top from useFit). Portrait results: YOUR BEST sat
  on the score line and collided with POINTS (now under the score, left), the terms' third line hid under POST IT
  (key down 14 px), the score line clipped POINTS (wider). Landscape results: one line of terms with the key over the
  rest (key now beside the terms, as on desktop; score 56 px so five digits + POINTS fit).
- Code audit, two read-only agents (engine, app) + my phone pass; applied (one commit):
  engine: sprites past the mouth sit on the bore until the frame shifts (the drop building stood mid-bore and jumped;
  place() adds branchX); dead conditions dropped (other-bore guard, `!st.taken` on drop stops); flare.webp and
  TUNNEL.flare gone; DISTRICT_NAME folded into sim NAME; kk array -> scalar; others() inlined; sidewalkX uses BAY;
  districtAt reused in course/render; TUN_* / GORE / FLAT hoisted out of draw(); pattern transforms without a
  DOMMatrix per call; branchX without a closure; fork loop iterates a copy (extend pushes); rules/chain comments;
  App's radar tunnel test uses fork.mouth; test: a street never holds more stops than SLOTS.
  app: settle effect guarded by a ref (chain is a new object per state change: a WON shot could settle twice);
  localStorage behind stored()/store() (blocked storage threw inside the frame loop and the run never ended);
  "YOU WIN! Done!" mixed case -> doneText "DONE!"; GC amounts en-US like every score; netSlow and audio.stop dead;
  ART / PORTRAITS in art.ts, fmt in board.ts (five copies before); status no longer repeats the key (CONNECT, POSTING);
  splash mute aria-label read the opposite state (dropped); action key aria-label falls back to the control's label;
  css: one .hud rule, the HUD number rule folded in, "seats" class word gone; results.json riders.note unread;
  79 art files no code path can name (menu -lit/-disabled faces the state machine never produces, share-blank-disabled,
  share *.webp duplicates of the .png the code loads, two stage previews for combos not on the dial, arrow-left,
  cone-cluster, sawhorse-on/off). Build clean, 66 tests, smoke run with no failed loads.
  Reported, not changed (Gaylord's calls): see the reply of 21:50.
- Gaylord's calls on the audit (22:00): Gamecoins spelled out where there is room (NEED GAMECOINS, PRIZE / STAKE /
  BALANCE rows via fmtGamecoin); GC stays on keys and in the HISTORY state column. "Record" everywhere (POST YOUR
  RECORD). WALLET rows left (explained). Version left. Landscape phones: the scene fills the window above the pad
  (`(pointer: coarse) and (min-aspect-ratio: 1/1)`), untested on a device. characters.json / venues.json stripped to
  the fields the game reads (16 + 20 KB -> 4 + 12 KB; the designer's fields live in ~/Code/pub). activeFork range
  commented. Tests written: hazards (cone, pothole, oil, oil grip, barrier spin / wreck, cap floor), reversing into
  traffic, edges across the widening and at a bay, candidate(), isRed(), traffic spawn on a branch. 74 tests.

## 2026-10-16, splash cropped (Gaylord: "zoomed in, very weird")
- The phone pass fixed every overlay to the window, so on a 16:9 desktop the 4:3 title scene was cropped by `cover` and
  BOOMERS lost its top, and the attract canvas (which maps 1280x960 onto its width) drew the riders and the ribbon off the
  picture. First patch (`contain` on wide windows) fixed the crop only; Gaylord: "the characters are coming from outside
  the screen". Fix: the splash is a centred 4:3 box again (canvas, riders, ribbon, mute key all in the scene), the attract
  fits its frame into any canvas shape (`frameOf`), `attract.test.ts` holds the geometry (frame 4:3 and centred for five
  window shapes, every rider inside the frame, mirrored on odd periods).

## 2026-10-16, World Lighting pack in (`~/Code/pub/PUB-World-Lighting`, briefs 6 and 7)
- Pack checked: 47 production PNGs at the sizes asked, trim masks byte-identical to the shipped ones, boards read right.
  Converted to webp (cwebp q85, 8 MB for 35 files) under the game's district names (`pano-casino-midday.webp`,
  `frontage-golf-night.webp`, `water-sunset.webp`, `scenery-venues-sunset.webp`, `buildings-atlas-midday.webp`,
  `fork-tower-podium-sunset.webp`). The tall 224 x 108 POST IT plates replace the stretched desktop key (crisp bevel, checked).
- Engine: `art.ts` `lit(file, hour)` maps night art to its midday/sunset repaint; `loadLight(hour)` fetches a stage's set when
  DRIVE is pressed (`start` in App awaits it; a miss logs and starts anyway). The renderer holds the stage's hour and rain
  from STATIONS: the song's sky (daylight skies for the seven daylight songs in `SKY`), ground / sidewalk / asphalt
  palettes per hour, the district's frontage band on both sides (`FRONTAGE` ppm + setback; one affine per slice like the
  tunnel walls, mirrored on the left, broken at forks, tunnels, venues and the destination), the waterfront's water plane
  (tile in world space, flat colour beyond 350 m), rain = cloud veil on the sky and skyline, wet sheen, 160 streaks.
  The night fillers are gone (the band replaces them, as the designer's note says); the 12 filler files stay in public/.
- Checked in Chrome: OUTRUN PULSE (waterfront midday) opens on a blue sky, the promenade rail with water behind, the
  casino street at midday through the tunnel with the pastel frontage and the daylight casino destination.
- The "trail of icons in the sky" over the casino street was the frontage band's top edge: the pattern repeated
  vertically, so the band's ground row wrapped onto the top of each slice as a hairline dash (the casino band is 32 m
  tall, so those dashes hung far above the horizon). Band patterns are `repeat-x` now. And a slice is a trapezoid (top
  converging, bottom not), so each slice is cut into up to 4 strips pinned on their bottom edges, which keeps the top's
  step under 3 px (it was 16 px near the camera and broke the spires into floating tips).
- Checked in Chrome after the fix: golf midday (stone wall, cypresses, daylight golf club), downtown sunset (frontage,
  warm sky, sunset skyline), downtown night + rain (veil, streaks, sheen; the night downtown frontage), golf night
  clear (night frontage), the tunnel. Frame time median 8.3 ms on the 120 Hz display. Not yet: phones, performance
  on a slow machine, the lamps' bulbs still lit by day (tiny), the TV previews untouched.
- Gaylord (22:40): "there aren't any curves anymore, only straight road". Checked: `node()` still rolls curves (70 % of
  150 to 350 m stretches, strength up to 0.05 per segment) and the renderer bends the road (seen at z 1670 on the casino
  street). The first street of this seed had one weak curve (0.0023); strengths are uniform in ±0.05, so weak first streets
  happen. Nothing changed in course.ts or sim.ts since the fork commits. Gaylord's call whether curves get a floor.

## 2026-10-16, 22:50, Gaylord's three remarks (screenshots in ~/Code/pub, 22.08 and 22.10)
- Radar: it went `display: none` from 400 m before a fork to the decision line, which hid the street's last stops (stops
  sit up to 950 m, the fork at 1200). The box stays on now: a target when there is one, SCAN otherwise (and in tunnels).
  The phones' fork line (`.fork`, coarse pointers only) is unchanged.
- BOOMER METER under the score: the rail moved from 158 to 190 design px (gap under the score box about 70 px instead
  of 40). Radar now 422 to 601.
- Fork "not symmetrical": the ground, not the arch. The gore's hatching was one diagonal stroke per slice from the left
  inner edge to the right, so the stroke ends piled into a white line on the gore's right edge only, and the gore's
  pavement covered the inner lines the two bores had drawn. Now the gore draws a white line along both edges and a chevron
  (point away) every other slice. I first chased the camera (a car in a lane makes the Y lopsided in perspective) and
  tried holding the camera on the axis through the fork; reverted, Gaylord did not ask for it. Checked at the line from
  the centre lane and the left lane.
- Gaylord's circle (22:33): the real asymmetry was a lilac wedge on the left of the split: each bore drew a sidewalk on
  both sides, and while the bores were closer than a sidewalk's width the right bore's inner sidewalk lay over the left
  bore's lane. A bore has no sidewalk on its gore side now, and the gore is plain road (same shade, same material tile,
  no markings at all; the chevrons of an hour earlier are gone). Checked 20 m before the line from the centre lane: one
  surface, the two inner lines meeting in a point.
- Kinked white line before the tunnel (22:37): the nearest slice is pinned to the near plane but took the branch offset
  at its segment start; the branch centre is interpolated at the slice's real ends now.
- Headlights come on 50 m before the mouth (ramp unchanged), so the car enters a lit tunnel; the exit bloom still keys on
  the actual exit.
- BOOMER METER (Gaylord, 22:40, clarified: "aligned in its own box"): the name at the left of its box, the points at the
  right, as SCORE does in its own; FULL follows the name, the points drop to their own line then. Measured: the points
  end flush with the panel's inner edge.
- Radar type (Gaylord, 22:50, "unreadable"): POSITION and AGE RANGE labels 2.8/2.6 to 4.4 cqw (about 6 to 9 px at 1280),
  the range 5.6 to 7.4 cqw, DROP OFF 4.6 to 6.2, a lighter label colour; labels moved up a little to keep clear of the range.
- Radar spacing (Gaylord, 22:55): POSITION up to 9 %, AGE RANGE at 68 %, the range at 79 %, so the reticle has air above and below.
- Radar map up with its label (Gaylord, 22:58): the reticle image sits at top -6 %, the blip's base line 44.4 to 38.4 %,
  POSITION at 5 %; the range block unchanged below.

## 2026-10-16, 23:10, hazards and weather (Gaylord: "potholes and oil don't look great, their effect is too minimal,
## wind on the rain, rain should affect the driving")
- Look: oil and potholes are ground decals now: the sprite's painted ellipse (448 x 160 of the 512 cell) laid flat as a
  3.6 m (oil) / 3.2 m (pothole) patch of road, projected by its own corners, so it foreshortens like the asphalt. A second
  pass in `screen` lifts the highlights so a dark pothole reads on dark asphalt. Far patches stretch along the road
  (depth = 0.36 x distance) to keep a quarter of their width in height on screen, shrinking back to round as they are
  reached (a flat 3 m patch is a one-pixel line at 60 m). Cones and barriers stay sprites. Checked at 13, 33 and 63 m.
- Effect: pothole = speed x0.7 (was 0.75) and a 1 m jolt to one side + POTHOLE! callout; oil = 2 s of slick (2.5 s in
  rain, was 1.2), wheel bite 0.25 (was 0.4), wander 20 (was 12) + OIL! callout. Cone unchanged (x0.7).
- Rain (sim.rain from the station): braking 28 -> 22.4 (x0.8), wheel bite x0.8, skid from 10 m/s instead of 15, the
  curve throws x1.3, and a crosswind: a side per run from the seed (`windOf`, no rng call so spawns are unchanged),
  0.9 m/s at top speed scaled by v/TOP. Rain streaks lean and drift with the same wind. Chain replay untouched (it checks
  stop positions and top speed only). Test: dry vs wet on the same downtown course (songs 1 and 2).

### Grand Prix menu (2026-10-16, night): PUB-Grand-Prix-Menu
Gaylord: "PUB-Grand-Prix-Menu in pub now, follow the info from in here and lmk if anything missing".
- [x] Art: the pack's layers under `web/public/art/gp/{layout}/` (fascia, lcd-bed, plaque, tv-bezel, tv-glass; 13 controls x
      rest / hover / pressed / selected / disabled / focus; the red key's seven words x four faces, off, scan atlas; the six
      purpose lines as the pack's PNGs; meter bed + segment; selection row), icons and the brand at 520 px; PUB Stereo LCD
      woff in `web/public/fonts`. Old `art/menu`, `art/tv`, `art/icons` removed → verify: no 404 in the console on any screen
- [x] Geometry: `game/data/menu.json` regenerated from component-contracts.json (scratchpad one-off gp-geometry.py): TV
      aperture path + safe rect + heading / count / rows / columns per list / review / scene / conditions; radio LCD, plaque,
      meter pitch, controls with hit rects → verify: desktop and phone keys land on the painted keys (DOM rects vs the boards)
- [x] HeadUnit.tsx rewritten on the pack: modes solo / challenge / my-runs / high-scores / wallet / system on named keys;
      BACK, ENTER, PREV / NEXT; the red key (DRIVE, SHOT, COLLECT, CONNECT, WAIT, dark) with the 220 ms legend swap and one
      scan; SHOT READY step before a funded shot drives; TV passive (no row clicks, no wheel); scores padded to five digits
      in the menu; six-band music meter from the analyser (35 / 180 ms, 20 Hz); keyboard: arrows, Enter, Esc, D, M, 1-6
      → verify: tsc, vitest, every state on desktop in Chrome (muted), portrait + landscape iframes
- [x] Departures and open calls written up for Gaylord (my-runs share rows, SYSTEM rows, collect-all) + designer brief 8

Built and verified (2026-10-17, 00:30): desktop SOLO RUN / CHALLENGE list + review / MY RUNS list + MY RECORD review /
HIGH-SCORES / WALLET / SYSTEM in Chrome (muted), keys 3, Enter, Esc, arrows, 1; the red key's dark gap and scan element
seen on a mode change; portrait 390x844 and landscape 740x340 in iframes (solo + challenge). No 404, 77 tests, tsc clean.
Where I departed from the pack, for Gaylord to overturn:
- COLLECT in a run's review collects everything owed in one transaction (as before), not that one note.
- SHOT funds the shot, then the review reads SHOT READY / PRESS DRIVE and the red key DRIVE starts it (the pack's step;
  before, the run started as soon as the wallet approved). A funded shot also waits under MY RUNS as READY.
- No CONFIRM, no FINISH: the chain layer has no in-app confirmation and no forfeiture (the champion collects a lost shot).
- MY RUNS has no COPY LINK / SHARE ON X rows on an open record (the review layout has no room for them; the results screen
  shares right after posting). Say the word and they go in as ENTER rows.
- SYSTEM rows: SOUND, VOLUME (ENTER steps 10 %, wraps), RESET BEST, VERSION, WALLET. The pack's MOTION and CONTROLS rows
  are not settings the game has. WALLET rows: STATUS, BALANCE (ENTER reads it), NETWORK, PLAYER, GAMECOINS (ENTER gets 10),
  DISCONNECT (ENTER); the red key reads CONNECT only when disconnected (GET GC moved off the red key).
- Enter no longer drives in SOLO RUN (the pack disables ENTER there); D or the red key does. Rows and the TV take no clicks.
- The scan steps the atlas at 8 equal 27.5 ms frames (the pack's 30/30/20/20/30/30/30/30 is not worth a JS timer).
- Trouble: the title (TRY AGAIN when a retry exists) mid-screen, the detail under it; the red key re-reads the word that
  was pressed. CHECKING (unknown broadcast outcome) is not a phase the chain layer surfaces.
Not verified: a real SHOT / COLLECT round through the new screens (needs a wallet approval; the flows under them are
unchanged), the pack's faces on a real phone.
- Gaylord (00:40): "put back the tv effect". The Stage TV glass's scanlines (a 64 px tile cut from the old glass.png, art/gp/scanlines.png) lie over the new tube's content, inside the clip, under the bezel and the pack's glass.
- Gaylord (00:50): the roadside buildings read "flat like paperboard". A second rank of the same frontage band stands 30 m behind the first, 1.6x taller, its columns shifted a third of a tile and hazed per hour (night dark, sunset mauve, midday sky blue), so roofs rise behind the near fronts and slide slower; the near rank throws a 3 m shadow on the ground at its foot. One hazed copy per band image (source-atop veil, cached). Checked downtown sunset, waterfront night, golf night; frame time median 8.3 ms, unchanged.

## 2026-10-17, one look per song (Gaylord's moods, "push the knobs one notch", "design elements per track")
- Stage table checked against the moods: fits, two debatable (OUTRUN PULSE sad under midday, NEON PURSUIT playful in
  rain), both kept on purpose (the name, the thrill).
- `docs/designer-brief-9.md`: lamp per district (+ the factory bulkhead), 3 to 4 signature pieces per song, what the
  engine does itself, formats, the cuts for performance (heat shimmer, long shadows, full frontage reflection, big
  murmurations). `docs/set-dressing-plan.md`: the per-song knobs (pushed), the dressing table, how each engine piece is
  drawn with its budget, the low tier guard (20 ms median for 2 s -> particles off, 1 strip, no decal pass, 70 segments).
- Not started: the knobs can go in before the art; the rest waits for the pack.
- Gaylord (00:30 screenshot, "bug in the menu?"): the results screen came up as bare wells and loose portraits. It shares the head unit's old CSS classes (.hu-screen, .hu-unit, .hu-text, .hu-gt, .hu-mono) and the Grand Prix rewrite deleted them with the rest. Restored under a results comment; the screen checked whole after a run.

## 2026-10-17, menu fidelity pass (Gaylord's feedback to the designer → ~/Code/pub/PUB-Menu-Fidelity-Fix)
Same geometry as the Grand Prix pack (every rect checked equal), so a face swap plus five corrections.
- [x] Faces: fascia, LCD bed, grey plaque, dark bezel, every key face (rest / hover / pressed / selected / selected-pressed / disabled; the focus brackets stay) → verify: no 404 on any layout
- [x] Type: Chakra Petch 600 for headings, names, legends; Share Tech Mono for the purpose line, counters, scores, clocks; PUB Stereo LCD and Boomer GT out of the menu; font-synthesis off; stage title 43 px, counter 24, metadata 20 on desktop (the proof) → verify: computed font-family on the title and a score
- [x] Logo: the restored compact mark (2.4:1), width set, height auto, in the top-left safe area, under the CRT layer → verify: rendered ratio
- [x] CRT: one combined layer (scanlines, phosphor, edge shade, sheen) over picture + logo + text inside the clip, the old tile and glass gone, the 256x192 buffer drawn pixelated as on the board; mounts + contact shadow between TV and radio → verify: screenshot vs boards/desktop-solo.png
- [x] LCD: the purpose line as live text (the plates had the old font baked in) → verify: PICK A STAGE AND DRIVE at 260,136.5
- [x] Red key: blank cap faces + transparent legends; a change closes the old word (60 ms), gap (20), opens the new (80), a glint settles (40); clicks suppressed for the 200 ms; 2 px press; dim legend when disabled; instant under reduced motion → verify: the phases seen in Chrome
- [x] tsc, vitest, desktop + portrait + landscape screenshots, 44 px hits

Built and verified (2026-10-17, 00:55): desktop in Chrome (muted): Chakra Petch 43 / 20 px and Share Tech Mono 24 / 30 px
measured on the title, metadata, counter and purpose line, font-synthesis none, logo 249 x 104 (2.41:1) at 66.8, 69.5;
no broken image in SOLO, CHALLENGE review, MY RUNS, SYSTEM; the red key's swap recorded frame by frame (close done at
~80 ms, glint peaks at ~175 ms, gone at 200 ms, NO ACTION on the button during the gap); portrait and landscape iframes:
no hit under 44 px, no broken image, logo 104 x 43. docs/screens/19-menu-fidelity.jpg. tsc clean.
Departures from the kit, for Gaylord:
- No idle bevel-light breath on the available key (optional in the contract; a 3 s pulse on a menu is noise).
- The glint is the hover cap fading over the last 120 ms of the swap; the disabled legend is the cream legend at 45 %
  (the kit's disabled face baked the word in, which the vertical close needs apart).
- The logo file is the restoration downscaled to 520 px wide (1.5 MB at 1942 px is a phone's whole budget); nothing else changed in it.
- The LCD purpose line is live text (the old plates had the LCD font baked in); the meter bed and segments are still the Grand Prix pack's.
- SOLO ENTER and root BACK stay disabled as before; list rows stay four tall (the Grand Prix geometry, untouched).
Another session was committing the song feels (f56d657, 5a702e3) in the same tree meanwhile; with them in, 78 tests pass.

## 2026-10-17, stale records on the testnet (Gaylord: "TRY AGAIN… course does not match its seed" / "not Pick Up Boomers game data")
- Probe of the testnet: 12 records + 1 shot under the note tag. 7 are rules version 1 (before Stage TV), 4 are version 2
  with a course the current generator no longer grows (feel per song, waterfront hills), 1 was genuine. All open, all expire
  within a day.
- [x] RULES_VERSION 3 (web and integration/src/game.rs); the course generator changing bumps it, said at the COURSE_COMMIT pin.
- [x] acceptNote drops any record or shot whose game data is not this version with the course grown from its seed: stale
  records leave every list (CHALLENGE, HIGH-SCORES, MY RUNS) instead of failing at the key. Test in flow.test.ts.
- Decision (mine, flag to Gaylord): a champion's own stale records vanish too, so their stake is not reclaimable from the
  app. Testnet coins; if a version bump ever happens with real money, keep stale notes visible for reclaim only.
- Checked in Chrome: CHALLENGE and HIGH-SCORES empty, no console errors. 79 tests, Rust replay green.

## 2026-10-17, the painted menu (Gaylord: the approved painting is the menu; the designer cut it: PUB-Painted-Menu)
- [x] The painting's pieces in: TV shell with its traced tube (new clip path), radio body with open wells, LCD glass, plaque, every key in six states, the blank red glass; the fidelity CRT layer kept over the tube (the painting's tube is baked, the pack says keep the game's CRT); logo, icons, meter grid kept
- [x] Text where the painting has it: counter top right (786.5 / 100.6, 24 px), heading at 92.6 / 552 (43 px), metadata 20 px with 22 px icons, logo 256 wide at 87 / 66; phones scaled to the tube with the Grand Prix minimums (18 / 12 / 11 px)
- [x] Stand-in fonts until the font pass (the pack: the painted lettering has no font): Boomer GT with its slant removed (skewX 10°) on headings, names, metadata and the counter; PUB Stereo LCD on the LCD line, scores, clocks and the red key's word (live text, so every word works); Chakra Petch on states and small labels
- [x] Verified in Chrome (muted): desktop solo / challenge / my runs / high-scores / system, fonts measured, no broken image; portrait + landscape iframes, no hit under 44 px; 79 tests, tsc clean. docs/screens/20-menu-painted.jpg
Open: the font pass (brief 12), the meter (both bad, later), a device check. Briefs 10 and 11 were never sent (overtaken).

## 2026-10-17, track signatures (Gaylord: "implement the changes yourself from PUB-Track-Signatures")
Plan (docs/set-dressing-plan.md steps 2 to 4), each step checked in Chrome on the stages it touches:
- [x] Art imported: the pack's sheets as webp under `art/songs/` (3.8 MB) and `traffic-pickup/taxi.webp`; fetched per song on DRIVE with the light (art.ts `LOOK`, `loadLook`). No 404, no console error on any of the 13 stages.
- [x] Lamps per district and hour (`lampOf`: the hour's 512 x 1024 sheet, the golf bollard sheet, the factory sodium pole on stage 3 with a flicker), NIGHT CRUISE spacing x2.
- [x] Props and tall pieces per song: the furniture slots take the song's props (home district: all of them; elsewhere every other slot), the tree slots take its tall pieces (smokestack, antenna + blinking beacon, tall palm, pylons, windmill, dead trees, olive tree, lighthouse + beam). ROAD CLOSED never mirrors.
- [x] Traffic sets per song (`feel.cars`), pickup and taxi sheets; HONK! on a bump in CRUSH UP. Vectors unchanged (the bot drives song 0 with the default set).
- [x] Curbs and dashes per song (`look.curbs`, `look.dash`).
- [x] Sky: moon (NOCTURNAL, small on CRUISE), helicopter with its rotor frames and the searchlight, gulls, blimp with the scrolling text behind its panel, Ferris wheel turning (left of the sky; on the right it sat under the HUD), three balloons, the synthwave sun, the bittersweet sun with its flare.
- [x] Ambient: stars, fireflies, festoon strings (NOCTURNAL), beat wash (SYNTHWAVE), smoke, steam, lightning (FACTORY), tail streaks (CHASE), water glare (OUTRUN), ground grid and horizon lines (VECTOR), verge dust (PICKUP), fog banks, far lightning, headlights on (DARK HORSE), rail strings (BITTERSWEET), gates every 200 m, wet streaks, speed lines, tinted rain, pulsing lamps (NEON), starlings (ORANGE), moon path (CRUISE), tube men at the venues (CRUSH UP).
- [x] Performance guard: 60-frame median over 20 ms for 2 s → low tier for the run (`[pub] slow frames` in the console); `?low=1` forces it; checked on NIGHT CRUISE. Frame intervals on this Mac: CRUSH UP median 13.1 ms p95 17 ms, BITTERSWEET 12.2 / 12.9 ms, no dropped frames, with another session's bench tab open in the same browser.
- [ ] The 6x CPU throttle check (DevTools, not reachable from the automation): Gaylord's call, or next session by hand.
- Fixed on the way: the renderer learned the song in the play effect, which could run after the first frame had stepped the sim (a silver car under the default sky on some runs); `start()` sets it with the sim now.
- Decisions (mine): props of other districts alternate with the song's outside its home district so the look carries through a run; the water tower and the dead trees stand in the roadside slot as the pack says, so they pass close to the camera.

## 2026-10-17, menu audit + LEADERBOARDS (Gaylord: "previous font on the tv", "DRIVE too tall", "GRAND PRIX more discreet", "LEADERBOARDS with pages like GQ, the LOSERBOARD")
- [x] TV on Chakra Petch (words) and Share Tech Mono (numbers) again; the radio's LCD line and the red key's word stay on PUB Stereo LCD
- [x] Measured against the painting (desktop px): heading baseline 552 / cap within 2 px, metadata and icons within 3 px, counter at the painting's corner (right edge 786.5), the LCD line 43 px into the glass on baseline 60 at 33 px (the painting's 416 px width), the red key's word at the painting's 73 x 21 legend (font 22 px, was 26.4)
- [x] Plaque dimmed (brightness .55, saturate .5): engraved, not a key
- [x] LEADERBOARDS: one board a page, PREV / NEXT, five pages in GQ's order (BEST RECORDS, MOST GAMECOINS WON, RIVALS BEATEN, RECORDS SMASHED, LOSERBOARD); hub.boards gained `losers` (each rival's lost shots, GQ's rule) with a test; NO ONE YET on an empty page; my row closes the page when I am outside its top
- [x] The key: no painted LEADERBOARDS face, so the pack's blank cap with the word drawn (Chakra Petch, .36 of the key height), states by filter, the painting's amber bar when selected; focus bracket copied from CHALLENGE
- [x] Verified: desktop solo + leaderboards pages 1 and 5 (NEXT off on the last), phones in iframes (no hit under 44 px, no broken image), tsc, 79 tests
Open: the drawn key word is whiter and heavier than the painted legends (the font pass, brief 12); the meter stays parked.

## 2026-10-17, link previews (Gaylord: "make sure game has a preview / thumbnail on X / TG / slack etc")
- [x] `og:url`, `og:image`, `twitter:image` absolute via `%SITE_URL%` filled at build (SITE_URL, else Vercel's production domain, else relative for a local build); JPEG card `art/share/og.jpg` (1200 x 630, the designer's share background and title with a four-line tagline) instead of the empty-box template webp, which nothing else used. Build checked with SITE_URL=https://example.test.
- [x] Card redone (Gaylord: "more punch"): the splash scene `art/title-scene.webp` at 1200 wide, cropped 35 px down (logo and sun kept), the middle car pose from `car-poses.webp` at 460 wide bottom right, a dark fade from the lower left, three lines in Chakra Petch SemiBold 52 px (yellow, cyan, pink) with a 5 px dark stroke and a soft shadow: "Drive & pick up boomers. Post your record. Challenge your rivals." Composed with ImageMagick, JPEG quality 88 (240 KB). The share PNGs next to it stay: `share.ts` draws the in-game share card from them.
- Needs the deploy to be seen: X, Telegram and Slack fetch the card from the live address; after the first deploy, paste the URL in a DM to each to confirm, and use the X card validator or Telegram's @WebpageBot to refresh a cached preview.

## 2026-10-17, night audit (Gaylord: "do a thorough audit: ponytail, visual, everything, and fix the obvious things")
Plan, each line checked before it is ticked:
- [x] Code: exports nothing uses, dead files under public/, CSS nothing references, leftover logs → verify: the scans, tsc, 79 tests
- [x] Desktop in Chrome (muted): splash, the six menu modes, a review, a run's HUD, pause, results → verify: no broken image, no text overflow, hits measured, fonts as decided
- [x] Phones in iframes (390x844, 740x340): splash, menu modes, HUD, results → verify: same checks, no hit under 44 px
- [x] Copy: em dashes, "X, not Y", words a neighbouring label already says → verify: grep + the screens
- [x] Build: chunk sizes, warnings, index.html / manifest → verify: vite build
Found and done (03:40):
- Dead files: the twelve `filler-*.webp` roadside sprites (brief 7's frontage bands replaced them, nothing loads them, 920 KB) and `gp/icons/cloud.png`; `lowTier` in render.ts exported and never read. Thirty other exports are used only in their own file or by tests: left as they are (no weight, no behaviour).
- No em dash, console.log or TODO in src; no CSS class or id without a user. Build: the SDK wasm 20.8 MB (6.2 MB gzip), the app 300 KB (100 KB gzip), no warning.
- Desktop (1728x886): no broken image, no overflow on any menu text; every radio key 41 px tall at that window (44.5 canvas px scaled); the menu on Chakra Petch / Share Tech Mono / PUB Stereo LCD, the HUD on Boomer GT / LCD as decided. Results: POST IT 207x100, the footer keys 456x65.
- Phones: menu hits 44 px (portrait) and 43 px (landscape, the pack's geometry); results footer keys 43 px tall on landscape (the kit's); no broken image, no overflow.
- Fixed: a portrait phone showed the road and the HUD (TIME 3:00, SCORE 0, SPEED 000) above and below the splash's 4:3 box; the canvas and the HUD are hidden while the splash is up (one CSS rule with :has, App.tsx untouched).
- Fixed: MY RUNS' footer read OPEN under a row that read OPEN; it now names the run's stage (the rows have no stage column, CHALLENGE's footer names it too), with the money or the rival's line at the right only when it says more than the state.
- Fixed: WALLET and SYSTEM page past four rows with nothing saying so; a cursor count (01 / 06) like the solo and leaderboards counters, only when there are more rows than the TV shows.
- Seen, left alone: the drawn LEADERBOARDS key word (brief 12), the meter (parked), the coarse-pointer check (the pad, the landscape full-width HUD) which an iframe cannot do; an automated `p` right after DRIVE is swallowed once (timing, as the 10-16 lesson says).

## 2026-10-17, the phone ran at a tenth of speed (Gaylord: "one second actually takes ten seconds", iPhone 16, Chrome)
- The loop caps catch-up at 0.1 s a frame, so a 700 ms frame is slow motion. Measured on the phone with three pages now in
  `web/bench/` (served by the dev server at /bench/…, not built): `bench.html` canvas micro tests, `bench-game.html` the
  real sim + draw with a per-operation bisect (`?song=N`, `&low=1`), `bench-app.html` the game with a stopwatch box
  (`?nohud`, `?nochain`, `?noaudio`). Every micro test ran at 17 ms; the bisect named the frontage bands: ~550
  `repeat-x` pattern fills a frame from a 2048 px tile, which WebKit's canvas rasterises ~1 ms each (580 ms a frame).
- [x] Frontage strips drawn as clipped `drawImage` slices under the strip's affine (render.ts `rank`): same pixels, 37 ms
  bare, the game at 1.00x on the phone (26 ms frames).
- [x] Canvas size rounded to whole pixels (App.tsx): dpr 1.5 on an odd CSS size never matched and WebKit rebuilt the
  canvas every frame.
- Left: the road materials' pattern fills are the other 20 ms on the phone (`without materials` 17 ms); fine at 37 fps.

## 2026-10-17, landscape phones (Gaylord: "the radar is on top of the gas button", "add a warning the game is designed to be played landscape", "keep the meter on the left and the radar on the right")
- [x] Measured in 844x390 and 740x340 iframes with the coarse-pointer rules forced: the rail's column ran 65 px under the scene, the radar (262 to 355) sat on GAS (302 to 374). Now a row on landscape phones: meter left, radar right, the rail ends 40 px above the pad on both sizes.
- [x] A phone held upright reads TURN YOUR PHONE: THE GAME IS PLAYED IN LANDSCAPE on the splash, above the ribbon (CSS only, 12 px on a 390 wide phone).
- Not checked on a device: the iframes cannot report a coarse pointer, so the real media query is untested there; the rules inside it were.
- Gaylord (phone in hand): the pad showed under the splash; the meter belongs on the left between TIME and SPEED, the radar on the right.
- [x] The pad is hidden under any overlay (splash, menu, pause, results) and shows for the run only.
- [x] Landscape phones: the meter at the left under TIME (its seats 100 board px tall, faces 42, figures 18 / 12, so a filled seat is no taller than an empty one), the radar at the right where the rail began. Measured filled and empty at 844x390 (meter ends 18 px above SPEED) and 740x340 (2 px above).
- [x] Portrait phones: the pad sat behind the rail (its margin used `--u`, which lives on `.app` only); the margin is in viewport units now and the pad clears the rail.
- All with the coarse-pointer rules forced into the iframes (lessons.md); a look on the phone itself is still the real check.
- [x] Fork approach (31 to 44 ms on the phone): the near frontage rank drawn from a canvas copy of the band (WebKit drew a
  transformed slice of the decoded image at ~0.05 ms, of a canvas for free), the strips unclipped with a step's overlap
  onto the one above (a clipped image costs by its area), the tunnel walls and ceiling through the same tiled() helper, the
  fork trims tinted ahead one a frame (the 15 ms hitch at the mouth). Open road 17 ms on the iPhone, tunnel 17, downtown 18.
- [x] The fork structure drawn only where it is on screen (near the mouth it spans several screens), frontage slices wholly
  off a side skipped. Gaylord on the phone after the previous round: "very playable now"; this round not yet measured there.

## 2026-10-17, track locks and the pickup / drop-off rule made visible (Gaylord: "ppl don't understand the pick up / drop off rule")
Decided: tracks 1 to 5 open for everyone; track n from 6 up needs n-5 records posted by this wallet (any track, open, smashed or expired all count) with one at (n-5) x 1000 or more; shots do not count; no wallet = 1 to 5; challenges ignore the lock (a rival's record on track 9 can be shot).
- [x] `game/unlock.ts`: need(i), unlocked(i, scores) → verify: unlock.test.ts (boundaries 5/6, 1000 exact, 13 = 8 records and 8000)
- [x] Head unit: a locked stage dims its painting, the conditions line reads LOCKED + the requirement, DRIVE is dark → verify: Chrome, this wallet has records so 6 opened and 13 read LOCKED: POST 8 RECORDS, ONE AT 8000+ with DRIVE dark; tsc
- [x] Fork cue: the HUD fork line on every screen size, the side a rider wants bright with blinking arrows and the count, the other side dim → verify: Chrome, two riders for DOWNTOWN: << DOWNTOWN / DROP OFF x2 blinking, CASINO STRIP >> dim
- [x] At the decision line, with a rider aboard for the street just chosen, the big callout says DROP OFF AFTER THE TUNNEL! in the district's colour for 3 s (Gaylord moved it from the mouth, where it read DROP OFF IN 230 M); nothing when nobody aboard wants it → verify: two sim tests
- [x] Tunnel warning: the radar says DROP OFF IN n M with the venue's icon when a rider aboard wants the bore's district → verify: Chrome, in the bore: DROP OFF / IN 180 M with the icon
- [x] Bays light up: the bay stripe pulses; bright for a drop bay a rider aboard wants and for a free pickup, faint otherwise → verify: Chrome, the downtown bay pulsing yellow past the tunnel; 82 tests pass

## 2026-10-17, portrait is a real way to play; no Gamecoins must not strand a record (Gaylord's iPhone screenshots)
- [x] The splash's TURN YOUR PHONE line removed: portrait is laid out (scene, meter and radar side by side, pad) and plays fine → verify: `web/bench/phones.html` (390x844 and 844x390 iframes of the dev server): splash, menu, HUD with the fork cue, results all fit in portrait; landscape on the real phone is Gaylord's check (an iframe has no coarse pointer, so the landscape HUD rules do not apply there)
- [x] Results, "NOT ENOUGH GAMECOINS" (trouble kind funds): two keys in the share row, GET GC (the faucet's 10, the note says to take them in the wallet) and POST IT, instead of TRY AGAIN alone; the record stays on screen → verify: tsc, 82 tests; the live state needs a wallet with no GC
- [x] WALLET menu: an ADDRESS row, ENTER copies it (for a faucet or a friend)

## 2026-10-17, two phone bugs (Gaylord's screenshots)
- [x] Inside the bore nothing from the sky reaches the road: the helicopter's searchlight, the rain sheen and streaks, the fog banks and the water glare are skipped while `inside` → verify: Chrome, MIDNIGHT CHASE and ABANDONED FACTORY in the bore, walls and strips alone
- [x] A pothole or oil patch in the sky: a decal stretches along the road with distance, and past about 650 m its far end fell beyond the last slice drawn, where place() has no row; the transform went NaN, the canvas ignored it and drew the patch full size at the origin. Now a decal whose far end is past the last slice is skipped, and the stretch never straddles a fork's mouth or its end, where place() shifts by the branch → verify: Chrome, hazards planted at 690 and 698 m, nothing at the top of the screen

## 2026-10-17, the painted LEADERBOARDS key (PUB-Leaderboards-Key, Gaylord: "to fix leaderboard word in menu")
- [x] The designer's six faces per layout in `art/gp/{layout}/leaderboards-{state}.png` (250x44 / 166x44 / 150x44, the same rects as menu.json); the blank cap, the drawn Chakra Petch word and its CSS states are gone. The key is now like the other three: one painted face per state. Faces checked loading on desktop and both phone iframes, selected and hover; tsc clean, 84 tests.
- The pack says the font pass (PUB Painted Pixel and PUB Painted Matrix) is delivered as PUB-Painted-Type, present in ~/Code/pub, not integrated yet: Gaylord's call.

## 2026-10-17, the font pass on trial (PUB-Painted-Type; Gaylord: "do that and send me the files i should look at to compare")
- [x] `?type=painted` swaps the stand-ins for the designer's faces: PUB Painted Pixel on words and the counter, PUB Painted Matrix on numbers, the LCD line and the red key's word. Cap heights measured at 100 px (Chakra Petch, Share Tech Mono, Pixel 70; Matrix 64.6; Stereo LCD 66.7): Pixel keeps the CSS sizes, Matrix gets x1.084 for numbers and x1.033 on the LCD so the caps stay where they were. Baselines come from baselineEm, so nothing moved.
- [x] Before / after captures of the desktop (solo, leaderboards, a review, challenge) and the phones in temp/type-compare, sent to Gaylord. His call; without the flag the game is unchanged.
- Seen in the phone captures and fixed: the review's status line (1 GC TO COLLECT, OPEN) sat on the stage name on phones, where the stage is 44 px under the score; the line now goes halfway between them there, the desktop position unchanged.
- Gaylord (19:50): "push the new one it's much better". The painted faces are the menu's fonts now; the flag, the PUB Stereo LCD face and its licence are gone. Chakra Petch and Share Tech Mono stay on the results screen, the radar and the splash ribbon.
- Gaylord: the splash ribbon "way too small, hard to read". 17 px Chakra Petch → 34 px in PUB Painted Pixel (Chakra Petch as the fallback while it loads). The face has no ampersand, equals or bullet, so the rules read AND, a colon and a slash between them.
- Results screen before / after sent (a CSS preview of the painted faces over the running screen); Gaylord's call.
- Gaylord (20:10): the results screen keeps Chakra Petch and Share Tech Mono; the ribbon change stays. Decided.

## 2026-10-17, evening audit (Gaylord: "ponytail and visual consistency and wording consistency and possibly more")
- [x] Code: no dead export; the counter's own font key was the same face as the words after the font switch, folded into `cp`; no CSS without a user; no unreferenced file (the three font licences stay).
- [x] The painted faces carry 43 glyphs; a comma, bracket, exclamation or question mark (history money lines, ??? for an unnamed player, trouble details) drew from the system fallback. Chakra Petch and Share Tech Mono are the per-glyph fallbacks behind them now; checked in the browser with "A, B! (C=?)" and "1,234 ???".
- [x] Wording: every player-facing string listed from HeadUnit, Results, App, attract, sim, hub, flow, useChain, stations. Vocabulary holds: record / shot / champion / rival, Gamecoin spelled out in sentences and GC in rows and keys, PASSENGERS everywhere, stage on the TV; states OPEN / READY / IN PLAY / COLLECT / WON / LOST / BEATEN / DEFENDED. No em dash, no "X, not Y".
- [x] Phones with the painted faces: smallest menu text 11 px (metadata, states); TIME LEFT's label was 8 px, floored at 11. The pack's phone geometry puts the heading 2 px over the first row's highlight (CHALLENGE), left as the designer drew it.
- The bench pages (web/bench/: canvas micro tests, the sim bisect, the stopwatch build, the phone iframes) are removed; Gaylord: not needed any more, the other sessions are closing.
- [x] Full visual pass after the other session's changes (Gaylord: "did you do a visual audit of all screens?"): desktop splash, HUD approaching a fork with a wanted drop (the cue blinks DROP OFF x1), the bore (the radar's DROP OFF IN n M), pause, results; phones in iframes with the touch rules forced through the same states, HUD boxes measured for overlaps. Clean except portrait's fork cue: 8 px between TIME and SCORE, and 12 px it ran into them; it now sits under the two boxes at 13 px. The tunnel alert on portrait is 14 px, fine.
- Gaylord: the portrait cue and alert "were fine", the bigger cue "too big and ugly, taking space". Reverted to the 30u cue in its place. Lesson in lessons.md.
- Gaylord: "as big as it can while never too close to TIME or SCORE". Measured on 390 px with a five-digit score and the widest pair (CASINO STRIP / WATERFRONT): the cue centred on the screen touched SCORE at 30 board px. Now centred between the two boxes at 27 (10 px clear each side at worst; 26 gave 13, 28 gave 7).

## 2026-10-17, every screen captured (Gaylord: "share EVERY screen", "be thorough")
- 38 captures in temp/type-compare/../screens: desktop splash, the six modes with their reviews and pages, HUD start / fork cue / tunnel alert / bore / bore exit, pause, results; phones side by side through the same states. Sent to Gaylord.
- Fixed: on phones the list heading's baseline (83) sat below the first row's highlight top (80.1), so the caps ran 7 px into the bar on CHALLENGE, MY RUNS, LEADERBOARDS, WALLET, SYSTEM; the baseline is 72 now (menu.json portrait and landscape), 5 px clear.
- Fixed: on a landscape phone (canvas wider than 4:3) the bore's near walls ended inside the screen and the world outside showed in a strip at the edge behind SCORE; the camera's slice now fills the sides outside its walls (render.ts tunnel). Checked in both bores.
- Seen, left: specks of the far frontage at the very top edge above the tunnel ceiling on landscape phones (pre-existing, a few px); the portrait results screen's YOUR BEST line tight under POINTS (the kit's geometry).

## 2026-10-18, Gamecoins and posting (Gaylord: "players report issues with understanding/posting")
- [x] A wallet request can no longer hold the screen for good: building the request plus the wallet's answer is capped at 2 min (config SUBMIT_TIMEOUT_MS); past it the player reads "Your wallet did not answer. Open it, then try again." with TRY AGAIN → verify: flow test (explain), tsc
- [x] Try again never pays twice: every builder reports the request's note ids before the wallet has it (bread setPendingListener), so a retry after a timeout or a failure first looks whether the request landed → verify: tsc; the live case needs a stalled Bread
- [x] No POST IT while the wallet is known empty: every balance read (the WALLET row, the post's own check, the grant) lands in `chain.balance`; the results well then reads NEED GAMECOINS, the terms line and one key, GET GAMECOINS; after the grant the well goes back to POST IT with the "10 GAMECOINS FOR YOU" note (Bread: balance unknown again until it takes the note; the test wallet: re-read). The key reads GETTING GAMECOINS while it mints. The note clears when the record posts → verify: ?local=10 and 11 fresh wallets, the whole path to RECORD POSTED
- [x] More places to get Gamecoins: an empty MY RUNS reads "NO RUNS YET / A POST COSTS 1 GAMECOIN. GET 10 FREE WITH THE RED KEY" with GAMECOINS on the red key; LEADERBOARDS gives a connected player with no runs the same key; WALLET's GAMECOINS GET 10 row stays → verify: ?local=9, the grant landed (BALANCE 10 GAMECOINS)
- [x] GC gone from the menus: BALANCE, TO COLLECT and the finished-run money lines spell Gamecoin / Gamecoins ("1 GAMECOIN WON, 1 LOST"); fmtGc deleted → verify: hub tests updated, 84 green
- A failed grant now offers TRY AGAIN (the success note is lost on that path, the balance tells). Skipped: a CANCEL key while the chain works (the cap ends every wait), a hint on the LOADING screen when the node never answers.

## 2026-10-18, SQQ's won claim refused: the shot window (Gaylord's iPhone, CLAIMING YOUR PRIZE with nothing else; Bread's popup showed the real reason)
Read from the chain (listChallengeNotes at 338118): SQQ's shot at KJS 11033 was made at 337876 with its deadline at 337990, 114 blocks
(5.7 min) for the review, a 3-minute drive and the claim through Bread on a phone. 12,370 beat it; the claim came after the deadline.
Bread simulated it, showed "assertion failed with error code 14434107113890732517" in its own popup and still let him confirm;
blake3 of the MASM messages maps the code to ERR_EXPIRED ("challenge: the deadline has passed"). The app heard only "approved" from
Bread, waited the 2 minutes, then read "did not go through yet, try again", which he confirmed 2-3 times. SQQ's earlier shot at JHT 11904
(320284, deadline 320399) is unconsumed too: the same loss once before. The shot at HSW 2145 landed in 70 blocks, so the flow can be fast.
- [x] SHOT_WINDOW_BLOCKS 6 min → 15 min (300 blocks). The chain lets a rival pick any deadline inside the record's life; the champion waits that long to collect a lost shot; MIN_SHOT_WINDOW follows (a record needs 15:40 left to be shot) → verify: flow tests, 86 green
- [x] A shot is driven only with 6 min left (SHOT_DRIVE_BLOCKS: the drive and as long again for the claim): MY RUNS reads LATE / TOO LATE TO DRIVE in pink and DRIVE stays dark; a funded shot that is already late is not reused by SHOT → verify: canDrive tests
- [x] The claim checks the deadline at the chain's current block before building: a late one reads SHOT_LOST ("Too late: your shot ended before the claim") at once, no wallet popup, no Try again → verify: tsc
- [x] NOT_FINISHED says where to look: "Not on the chain after 2 minutes. Your wallet may have refused it: look there. Nothing is spent until it lands."
- [x] Every wait says where it is and how long (flow.ts waiting, results and head unit): CONNECTING YOUR WALLET / GETTING READY, A FEW SECONDS / OVER TO YOUR WALLET, APPROVE IT THERE, UP TO A MINUTE / WAITING FOR THE CHAIN, USUALLY UNDER A MINUTE, with a clock since the step began (the results screen ticks while busy); the shot screen reads RECORD BEATEN from the score before the chain confirms → verify: ?local=11 post, the states PROVING 0:00..0:01 → WAITING FOR THE CHAIN 0:00..0:06 → RECORD POSTED; waiting() test
- Not done: nothing recovers SQQ's two Gamecoins (KJS and JHT can collect them); a countdown to the shot deadline on the results screen.
- Gaylord's calls (10:10): the window stays 6 min, one shot is one drive, a failed shot is a lost coin; no chain, notes or mechanics in anything a player reads. Done:
  SHOT_WINDOW_BLOCKS back to 120; the shot deadline counts from the node's tip (the client's sync lagged it by 6 blocks); SHOT_DRIVE_BLOCKS 100
  (a minute to press DRIVE, the drive, two minutes to claim); settlePlan's `again` and the results TRY AGAIN on a lost shot removed (NEW RUN);
  a late claim reads SHOT LOST in pink, "Shot lost: too late for the claim. Your Gamecoin goes to the champion.", no retry; TRY AGAIN stays
  only where nothing is at stake (post, collect, connect, Gamecoins, a claim with time left). Words: "Not done after 2 minutes. Check your
  wallet, then try again." / "Your wallet was not ready." / "No such record." / "This record is not from this game." / "That did not work." /
  "The network is slow right now." / SENDING instead of WAITING FOR THE CHAIN / LOADING instead of LOADING THE CHAIN; the raw error detail
  no longer shows on the TV (console only); the TV reads TRY AGAIN WITH THE RED KEY under a retryable trouble. Scores in verdicts with separators.
  Left as is: the WALLET page's NETWORK row (MIDEN TESTNET), SYSTEM's WALLET row, the terms line.
- [x] SHOT starts the drive at once (Gaylord: yes to the gameplay option): no SHOT READY / PRESS DRIVE review, the `ready` state gone; a shot funded but not driven (reload) still shows READY with DRIVE in MY RUNS → verify: ?local=11 shot at HSW 2419, driving 5 s after SHOT, RECORD BEATEN at time-up with the waiting lines (GETTING READY, PROVING, SENDING with clocks), "2,985 POINTS. YOU WIN! DONE!", NEW RUN / MENU
- [x] The raw error is back on the TV under the title (Gaylord: "copy-paste the error and tag @zkGaylord on X"), capped at 240 characters, selectable text, the tag line after it → verify: tsc

## Screen audit, one by one (2026-10-18)
Player's order. Each screen: screenshot to Gaylord, short suggestions, his feedback, fix, confirm, next.
1. Loading splash (progress)
2. Splash, CLICK TO START
3. DRIVE root (stage dial, TUNING)
4. DRIVE, locked stage
5. Run HUD, first seconds
6. Run, paused
7. Run, last 20 s (late clock), callouts
8. Results, no wallet installed / not connected
9. Results, NEED GAMECOINS
10. Results, getting Gamecoins (busy)
11. Results, POST IT ready
12. Results, posting (busy, waiting lines)
13. Results, RECORD POSTED (share)
14. Results, post trouble
15. MY RUNS, not connected (CONNECT)
16. MY RUNS, NO RUNS YET
17. MY RUNS, list
18. MY RUNS, MY RECORD opened
19. MY RUNS, SHOT READY / TOO LATE opened
20. MY RUNS, COLLECT
21. CHALLENGE, list
22. CHALLENGE, NO CHALLENGES YET
23. CHALLENGE, review (SHOT)
24. CHALLENGE, review of my own record / RECORD OVER
25. CHALLENGE, shot being funded (busy)
26. Shot run HUD
27. Shot results, CHECKING RESULT / RECORD BEATEN while settling
28. Shot results, settled: win / RECORD HELD / SHOT LOST
29. LEADERBOARDS, three boards
30. WALLET, not connected / connected
31. SYSTEM
32. TV trouble + note lines (ADDRESS COPIED, COINS RECEIVED)
33. Record opened by link (?record=), POWER off
Then the phone layout of the main ones.
- Screens 1-3 reviewed. 3: LEADERBOARDS label read taller than the other keys (14 vs 13 px rows, half a pixel low); scaled 13/14 about its centre in all six labelled states, both packs (scratchpad apply.py). Keep CLICK TO START as is.
- Screen 4 (locked stage): wording and hidden details stay as they are (Gaylord). Added a padlock, inline SVG in the kit's line-icon style, pink, centred on the tube.
- Screen 5 (run) fine. Screen 6 (pause): subtitle repainted in pause.png to "CLOCK STOPPED, CLICK TO RESUME" (Share Tech Mono 17 px, same colour and cap rows as the painted line; original kept in the session scratchpad).
- No-Bread journey (Gaylord 2026-10-18, from screen 8): a card over the head unit once the chain has looked for Bread (1.5 s after the menu): desktop "You need Bread to post your record and challenge rivals. Without it, only the first stage plays.", touch screens "Open the game from the Explore tab in Bread ... No Bread yet? Get the app."; GET BREAD opens miden.xyz/bread, PLAY ANYWAY closes it. Stages 2 and up read LOCKED WITHOUT BREAD with the padlock. MY RUNS, WALLET and the results well offer GET BREAD where they asked to connect. Bread present but refused or disconnected keeps CONNECT. The results well suggestions (terms beside CONNECT, NOBODY PICKED UP) are parked.
- Testing without Bread in this Chrome: open http://[::1]:5180/ (the extension's content script matches only localhost, 127.0.0.1 and https).
- Card copy (Gaylord): title NO BREAD?, "You need Bread Wallet by Miden to post your record, challenge rivals, and unlock tracks besides track #1." plus on touch screens "Already installed? Open the game from the Explore tab!"; a locked track reads GET BREAD TO UNLOCK and the red key reads GET BREAD there.
- Card sized in screen pixels (clamp), not --u: 38/19 px on desktop, 24/15 px on a 390 px phone; "Bread Wallet by Miden" and "Explore" in amber.
- Radio LCD line (Gaylord, phone screenshot): caps centred on the glass in all three packs (menu.json purpose baselines: desktop 137, portrait 166.7, landscape 135.4), portrait size 17.8 -> 23 so the longest line ends 24 px before the meter. The Explore sentence on the card is its own paragraph with a gap above.

## Share on X (2026-10-18)
- Gaylord: SHARE ON X did nothing on the phone. The intent link itself opens X's composer on desktop (checked). Bread's in-app browser returns null from `window.open`, so the key now falls back to opening X in the same tab when the popup is refused.
- Post text is Gaylord's, verbatim, with the station id as the second hashtag (midnight-chase → #midnightchase):
  `Try to beat me for 1 Gamecoin` / `#pickupboomers #midnightchase 👴👵` / link on its own line. The four rotating lines, the score and the UTC expiry are gone.

## Record link preview per record (2026-10-18)
- Gaylord's layout (his mockup, measured): logo 442 wide centred at y 42; a boomer waving, 358 tall, feet at y 600, 176 px from one edge;
  the balloon "CAN YOU BEAT <score> PTS?" (PUB Painted Pixel, pink score, drawn "?" and ",") on the other side, left edge 566, top 211,
  tail to 55 % of the way to the head; Powered by Miden badge 226 wide at 70 % in the free bottom corner; the TV pass (bloom, scanlines
  every third row, vignette) over everything. Boomer (48) and side come from the record id.
- Built as Vercel Python functions with Pillow (reuses the drawing code verbatim): `web/api/card.py` draws the JPEG, `web/api/share.py`
  serves the page with that record's preview tags for links carrying `t` (vercel.json rewrite). Assets in `web/og/` (copies of the stage
  art, the three passenger sheets, the pixel font as TTF, the logo, the badge); everything else excluded from the bundle.
- The share link is `/r?record=ID&t=<track id>&s=<score>`; the game only reads `record`. No or bad score: "CAN YOU BEAT MY SCORE?".
  It needs its own path: Vercel serves the static page for `/` before any rewrite, whatever the query (a `has` query rewrite on `/` never ran, 2026-10-18).
- Gaylord may ask the designer agent for the first 16 standing characters at 2x (cells 512 x 768): they are the soft ones on the card.

## LEADERBOARDS: ten rows a page (2026-10-19)
- Gaylord: "leaderboards must have 10 rows per page, with possibility to scroll". The screen is now two levels like CHALLENGE: the five
  boards as a list (how many players on each), ENTER opens one; a board shows ten rows a page in smaller type, PREV / NEXT turn the
  pages ("02 / 04" top right), BACK returns to the list. My row closes every page I am not on (pages of nine then, no rank skipped).
- BEST RECORDS ranks players by their best record (one row each); every board keeps a hundred rows (hub.ts). Before, a fourth row read "08".
- A 503 from the faucet reads "THE GAMECOIN FAUCET IS DOWN. TRY AGAIN LATER." (was the network line).

## WALLET screen (2026-10-19, screen 30/33)
- BALANCE reads on the first WALLET visit of each connection (Bread serves asset reads to a connected site without asking; measured 3.5 s); the row says READING meanwhile, ENTER reads again.
- STATUS row takes ENTER until connected: CONNECT (Bread present) or GET BREAD (none), the same as the red key. Cursor stays on STATUS.
- Trouble headings: the first sentence is the heading, the rest opens the detail paragraph (every title over ~35 characters clipped on the one-line heading, the faucet line first).
- NETWORK row moved from WALLET to SYSTEM (Gaylord 2026-10-19: WALLET is for making the wallet work and concrete info, the network is informative). SYSTEM now six rows, WALLET six when connected, two when not.
- LEADERBOARDS list shows all five boards at once: a fifth row at the same step (desktop 548, phones 222), no page counter (Gaylord 2026-10-19: there is room on the TV). Board pages stay at ten rows.
- SYSTEM: VOLUME row dropped (the radio's VOL keys do it). Bread exposes no version to the page (checked the injected midenWallet object and the 1.17.4 bundle, 2026-10-19): the WALLET row stays BREAD until it does.

## WALLET vs SYSTEM reorganised (2026-10-19, Gaylord)
- WALLET: STATUS (ENTER connects until connected), PLAYER, BALANCE, RESET BEST (from SYSTEM), DISCONNECT. BALANCE carries its one action: "N GAMECOINS. ENTER TO CLAIM" when coins are owed (ENTER collects everything owed, then reads again), "N GAMECOIN. ENTER TO GET 10" at 1 or less, else the number (ENTER reads again).
- SYSTEM: VERSION, ADDRESS (from WALLET, ENTER copies), NETWORK, STATUS, RPC. SOUND and VOLUME rows dropped (the radio keys do it), the TEST/BREAD row dropped.
- STATUS reads the testnet monitor through api/status.py (status.testnet.miden.io serves HTML without CORS; the function parses the service cards, s-maxage 30 s). The game needs three of its services: RPC, Remote Prover, Local Transactions; the first unhealthy one names the row ("TRANSACTIONS DOWN"), else ALL GOOD; CHECKING while fetching, UNKNOWN when the monitor is unreachable. ENTER opens the monitor.
- RPC is the endpoint the game reads from (chain.rpc, from the SDK Endpoint). Bread's own endpoint is not typed in the adapter.
- Five rows fit WALLET, SYSTEM and the board list (five() in HeadUnit).
- SYSTEM values in Share Tech Mono amber like WALLET and every list value (Gaylord 2026-10-19, "more consistent with the rest of the screens"). The board list's player counts sit at the right value column (they ran into the names on phones at the mid-screen score column).
- BEST RECORDS ranks every record posted, a player as often as they posted (Gaylord 2026-10-19; yesterday's one-row-per-player undone). The board list counts players on every board ("5 PLAYERS"; BEST RECORDS counts distinct champions, its own page shows the records).
- Board pages: ten rows a page, the last page shorter (Gaylord 2026-10-19: "always 10 lines"). My standing rides the footer line, right of the board title, on the pages my rank is not on and when it is outside the top hundred (it took a row before, pages of nine).

## Coins to collect, told once (2026-10-19, Gaylord's idea)
- When the menu is idle with the notes read and the wallet has coins owed, the TV says "N GAMECOINS TO COLLECT" with the reason under it (rivals tried and failed / a record ran out), the red key COLLECT takes everything owed, BACK leaves it; the LCD reads COLLECT YOUR GAMECOINS meanwhile (Gaylord: the LCD says what is happening). Once per wallet and session (a module mark, the head unit unmounts for every run). MY RUNS blinks on the radio, once a second on the clock tick, while coins wait there (steady under reduced motion); that is how "later from MY RUNS" is said.
- COINS RECEIVED counts down five seconds ("BACK TO THE TRACK IN 5") and goes to the DRIVE root (Gaylord 2026-10-19: the screen stayed on the note). BACK cuts it short. The other notes (address copied, best cleared) still wait for BACK.
- Share on X: eleven first lines (Gaylord's list, 2026-10-19), one drawn at random per share, {score} / {track} (capitals) / {stake} filled in; the hashtag line and the link unchanged, except that the 👴👵 after the hashtags stay off when the line carries a boomer of its own. "millenials" spelled millennials.
- CHALLENGE: the highlighted record's stage painting sits behind the list, and the reviewed record's behind the review, at brightness .22 and saturation .8 (Gaylord 2026-10-19: the background as the selected track's picture, dimmed for contrast; .3 left the midday stages busy under white text).
- [x] CHALLENGE and MY RUNS backdrops dimmed to one level (Gaylord 2026-10-19): every stage painting is measured at preload (mean luminance on a canvas, 0.15 night to 0.49 midday) and its brightness filter set inline to 0.045 / mean, so night comes out at 0.30 and midday at 0.09; MY RUNS shows the highlighted or opened run's stage the same way → verify: build, 86 tests, desktop + both phone frames on a night and a midday record, MY RUNS list and review on local wallet 11
- [x] Share on X lines carry the record's expiry (Gaylord 2026-10-21): `{until}` = "20 Oct 17:24 UTC" from the posted record's expiresAt, folded into the sentence when there is one ("before …", "by …", "until …") or on its own line ("You got until …", "Prove it before …") → verify: flow.test.ts (every line names the date), build
