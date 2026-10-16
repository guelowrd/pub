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
