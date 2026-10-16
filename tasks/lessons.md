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
