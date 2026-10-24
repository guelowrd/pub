## 2026-10-15 playtest corrections
- A class name shared between unrelated elements (`.face` on the splash lettering and on HUD portraits) threw the start prompt off
  centre. Before saying a screen is done, measure it (getBoundingClientRect against the container), do not eyeball a screenshot.
- When Gaylord reports how something reads in play (steering pose "turns right"), do it his way the first time and offer the
  convention as the alternative. Arguing geometry cost two rounds.

## 2026-10-16 chain flows
- Never edit source while a wallet flow runs in a dev-server tab: Vite's full reload wiped a mint mid-flight. Run the end-to-end
  on a production preview (`vite build && vite preview --port 5181`) and keep the dev tab for edits.
- A key press sent right after a click that mounts a screen lands before that screen's listener exists; wait a beat in
  automation, it is not a bug for a human.
- A generic `.overlay button` rule outranked the `.hit` class on the head unit's invisible buttons and painted them navy over
  the key art; when a skinned screen looks tinted or flat, check `elementsFromPoint` for a styled hit area before suspecting the art.
- Do not invent mechanics: the prize chips were not in GQ nor asked for. The chain layer mirrors GQ's rules; a new knob needs Gaylord's word first.

## 2026-10-16 results kit
- A dynamic `import("/src/x.ts")` from the console returns the module instance the page already holds, edits and all missed;
  add a cache-busting query to get the file as it is on disk.
- A projection clamp (`max(0.3, dz)`) is a bug wearing a safety belt: the nearest road slice drew from a bogus distance for
  hours (blurred tile, lane lines cut at a hard edge) because the clamp hid the division by zero. Clip to the near plane instead.

## 2026-10-16 high-speed road test
- A projection fix verified on flat ground only (the near plane took the camera's absolute height) broke every hill. A
  geometry change in render.ts is checked on a hill top, a dip, a curve and a tunnel exit at top speed, with the
  console autopilot (pin v and x per frame) and a canvas recorder, before it is called done.
- "Weird at speed" means a per-frame artefact: measure frame-to-frame deltas of a road edge and split them by whether
  the camera crossed a segment start; a sawtooth shows up as crossings that move differently from the frames between.

## 2026-10-16 HUD fonts
- A font family swap at the same pixel size reads as a size change: Share Tech Mono's x-height is far under the pixel
  LCD font's, so the HUD "shrank" with no size edit (Gaylord: "the font is now minuscule"). When swapping families on a
  screen the player reads at a glance, compare the two on that screen before calling it done, and keep the old family where it lost.

## 2026-10-16 tunnel mouth ring
- A fix checked at the distance where the bug showed (40 m) broke at the distance the player passes through (5 m):
  the even-odd ring box was fine far away and blacked the frame close up. A screen-space fix is checked along the
  whole approach, with frames captured at the moment of passing, not at one freeze.
- Vite HMR does not always reach the render loop's closure; a "toggle has no effect" result after an edit means
  reload the page before concluding anything.
- Test runs in Chrome play the game's sound on Gaylord's machine (2026-10-16, "can you turn the sound off"). The mute
  is not persisted, so every test run presses `m` (or clicks SOUND OFF) right after the splash click, before DRIVE.

## 2026-10-16 fork frame switch
- When the same scene is drawn by two code paths before and after a state change (here the frame re-centring on the
  chosen branch), the seam shows no matter how the maths is reconciled. Keep one path and move the unavoidable switch
  to where it is a pure translation of identical geometry (the straight bore at the mouth). Three patches on the two-path
  version (trunk-behind slice, fan, gore order) each fixed one symptom and left the jump.

## 2026-10-16: a layout fix gets the whole screen checked, every layer of it
The phone pass made overlays window-sized and I checked the results screen and the menu, never the splash. Then I patched
the splash's visible symptom (the cropped picture) and declared it fixed while the attract canvas on the same overlay was
still drawing off the picture. Rule: when a container changes shape, list every child that assumes its old shape (CSS
backgrounds, canvases with reference frames, absolutely placed keys) and look at each in the browser before saying done.
A symptom fix that leaves a sibling layer wrong is a second bug.

## 2026-10-16, "the fork is still not symmetrical" (third time)
Gaylord pointed at a screenshot by name and I theorised from code before opening it, then built a camera change for the
wrong asymmetry (the lane's perspective) while the real one was the gore's hatching leaning one way. Rule: when a remark
names a screenshot, crop and read that region first, list the asymmetric elements in it (lines, hatching, edges), and
match each to the code that draws it before touching anything. A perspective effect is never the answer to "symmetric"
when the complaint is about markings.

## 2026-10-17, the results screen lost its text with the menu rewrite
Replacing the head unit, I deleted every `.hu-*` rule in index.css as "the old menu's". Results.tsx used the same classes
(board.ts even says the helpers are shared by both screens). Rule: before deleting a CSS class or helper, grep the whole
src tree for it, not just the file being replaced; and a rewrite of one screen gets the neighbouring screens (splash,
results, pause) looked at before it is called done, as the 2026-10-16 layout lesson already said for layout changes.

## 2026-10-17, "TRY AGAIN: this record's course does not match its seed" on every listed record
I changed the course generator twice (feel per song, waterfront hills), regenerated the vectors and re-pinned the
commitments, and left RULES_VERSION at 2. Every record on the testnet then failed at shoot time, and the version 1
records from before Stage TV had been failing silently all along, because the version check only ran when a rival
pressed the key. Rule: a course generator change bumps RULES_VERSION (the COURSE_COMMIT pin moving is the signal, now
said next to it), and notes the app cannot drive are dropped where every note enters (acceptNote), never caught at the
last key.

## 2026-10-17, a run drew the default look (silver car, default sky) on some starts
The renderer's `setSong` lived in the play effect behind `sim.t === 0`; a frame could step the sim before the effect
ran, and the run then kept the default look; the music had the same race and kept the menu track (Gaylord heard it). Rule: state the renderer needs for a run is set where the run is made
(`start()`, with `newSim`), never in an effect that infers "fresh run" from mutable state. And in Chrome checks: the
menu remembers the stage, so step it from the keyboard (ArrowRight x n after a reload) and read `pub.sim.current.song`
before trusting a screenshot; a click during the splash's attract mode looks like a run and is not one.

## 2026-10-17, "one second takes ten seconds" on the iPhone
Four confident theories (texture memory, canvas resize, scratch canvas copies, gradients) came from reading code and
desktop numbers; two were real but small, two were wrong. What found it: run the actual draw on the actual device and
bisect it by operation kind (no-op one canvas method at a time, read the frame interval). Rule: on a device I cannot
inspect, measure before fixing, and bisect the real frame rather than micro tests of what I think it does. WebKit's
canvas: `repeat-x` pattern fills from a big tile cost ~1 ms each; `drawImage` under a transform is free.

## 2026-10-17, the phone HUD checked in iframes that never showed the pad
The night audit called the phone layouts clean after iframes at 390x844 and 740x340, but an iframe in desktop Chrome has a
fine pointer, so the `(pointer: coarse)` rules (the pad, the full-width landscape scene) never applied; Gaylord then found the
radar on the GAS key, the pad under every splash and the portrait pad behind the rail. Rule: a phone check injects a copy of
the coarse-pointer rules without their media condition into the iframe and measures with them on, on every screen state
(splash, menu, run with a filled seat, pause, results), before the layout is called clean. And a `var(--u)` used outside
`.app` resolves to nothing: the custom property lives on `.app` only.

## 2026-10-17, "no deployment exists" was wrong
I probed guessed vercel.app names, found pub.vercel.app owned by someone else, and told Gaylord nothing was deployed. The project was live at pub-swart.vercel.app, deploying every push. The repo's commit statuses (GitHub API, no auth needed on a public repo) and the Vercel dashboard's project list were one request away and definitive. Rule: before saying "not deployed", read the commit statuses or the dashboard; never conclude from guessed URLs or an unchecked todo item.

## 2026-10-17, the portrait fork cue "now too big and ugly"
I enlarged the portrait fork cue and moved it under the clocks because it measured 8 px in an iframe. Gaylord had seen it on
his phone and it was fine; the bigger cue crowded the side boxes. Rule: a size Gaylord has looked at on the device and not
complained about is not a finding. A phone's pixels are denser than an iframe's; "n px in the iframe" says nothing about
legibility in the hand. Phone type sizes change on his word (as the ribbon did), never on my measurement alone.

## 2026-10-18, a six-minute shot window lost a won claim on a phone
The window was sized on the desktop flow (drive 3 min, local wallet signs in seconds) and judged "fine" from one night's blocks. On a
phone the same flow has a review screen, a Bread popup to find, proving and a slow network; SQQ lost two Gamecoins to it.
- Size every chain deadline for the slowest real flow (phone + Bread), then guard the action that starts it: do not start what cannot finish in time.
- When a wallet acknowledges before executing, the app never sees the failure: check the refusable conditions (deadline, balance) on the app side first, and tell the player to look in the wallet when the chain shows nothing.
- A wait with no stage, no duration and no clock reads as a hang: every busy state says where it is, what to do and how long it takes.
- Correction (Gaylord, 10:10): the window was not the problem, the retry was; one shot is one drive and a failed shot is a lost coin. Do not
  stretch a game rule to absorb a UX failure. And players never read mechanics: no chain, notes, blocks, proving; they POST and SHARE, or
  TAKE A SHOT and WIN or LOSE; waiting steps are flavour, never something a player must understand to act.
- To simulate "no wallet", hide it before the adapter is built, never after: the wallet adapter detects Bread once at load, and deleting the injected object later leaves readyState Installed while connects fail, so the provider loops between a named and a null wallet and every state derived from it flickers. A different origin the content script does not match (here http://[::1]:5180/) is the honest test.

## Composition is Gaylord's (2026-10-18)
Eight layout variations of the record card and none landed; Gaylord: "Your sense of positioning and design isn't great. Can you please give me the assets I'll do it myself." When a visual needs composing (where things sit, how big), build the layers and hand them over as separate transparent PNGs with the fonts and colours, then implement the layout he returns. Measuring alignment is my job; choosing it is his.

## A grep in a push chain hides a red suite (2026-10-19)
`npx vitest run | grep "Tests "` exits 0 whenever grep matches, so `&& git push` ran on a failing suite. Run the suite as its own
command and read the result before the commit, never pipe it into grep inside the chain that pushes.

## Every changed screen gets looked at, on all three layouts (2026-10-19)
Gaylord: "pls do some visual checks, you re going too fast on these assuming everything is fine." I had shipped SYSTEM with white Chakra Petch values next to WALLET's amber mono, and the board list's counts colliding with the names on phones, after measuring only that text was not clipped. A clipping probe is not a look. Rule: after any change to a TV screen, screenshot it on desktop and in the two phone iframes, look at it against its neighbours (same face, same colour, same column as the other lists), and measure the gaps between columns, not only overflow, before saying it is done.

## `tsc --noEmit -p .` checks nothing here; the build is `tsc -b` (2026-10-19)
Three deployments failed in a row (3a9ca35, 211e8b8, 2a5b615) on a shadowed import (`waiting`) that my check never saw: web/tsconfig.json is a solution file with references, so `tsc --noEmit -p .` type-checks zero files and exits 0. Vercel runs `npm run build` = `tsc -b && vite build`. Rule: the pre-push check is `npm run build` (or `tsc -b`), never `tsc --noEmit -p .`; and after every push, read the commit status (api.github.com/repos/guelowrd/pub/commits/<sha>/status) before saying it is live.

## A wallet check in my tab is not a check in Gaylord's (2026-10-21)
- I measured Bread's asset read in my own tab on 10-19 (3.5 s, no approval click) and put a balance read on WALLET arrival on that basis. The code's own comment said Bread asks before every asset read, and Gaylord got a pop-up on every visit.
- Rule: anything a wallet does with approval is verified in Gaylord's wallet, or left on the player's request. A clean run in my tab does not overrule a comment that records the opposite.

## "The best score" on a board is rank one, not my row (2026-10-21)
- Gaylord asked for the best score as the first line of every board page; I pinned the connected wallet's own row and shipped it. On a leaderboard "the best score" means the number one.
- Rule: when a request names a board value, read it as the board's own value first; my own standing is only ever "my row" or "my standing". When two readings differ this much, show both in one line before building.

## A trouble line tells the player what to do (2026-10-23)
"YOUR WALLET IS ON ANOTHER NETWORK" with the raw error under it was rejected: Gaylord wanted MAKE SURE YOU'RE ON MIDEN MAINNET.
When the fix is on the player's side (a wallet setting, a missing coin), the heading names the fix, not the state, and the raw
error stays out: there is nothing for them to copy to me. Keep the raw detail for failures I need to see.

## `tsc --noEmit -p .` checks nothing here (2026-10-23)
web/tsconfig.json only holds project references, so `tsc -p .` is a no-op and said "ok" over a HeadUnit.tsx missing a brace (a `//` comment I had pasted into a one-line function swallowed its tail). The type check is `npx tsc -b` in web/ (what `npm run build` runs). Never append a `//` comment inside a one-line block.

## Deploy check: grep the chunk, not just index (2026-10-23)
The live bundle splits: flow.ts lands in `assets/hub-*.js`, so a marker string from it is never in `assets/index-*.js`. A "not live after 10 min" from the watcher was a false alarm while Vercel said success. Watch the index hash for a new deploy, then grep the marker across every chunk the index names.

## Deploy check: comments never reach the bundle (2026-10-24)
Grepping the live chunks for a code comment finds nothing: the minifier strips them. Grep a player-facing string the change
added, or when the change adds no string, trust two facts together: the live index hash changed after the push and
`GET api.github.com/repos/guelowrd/pub/commits/<sha>/status` reports Vercel success for that sha.
