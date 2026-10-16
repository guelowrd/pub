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
