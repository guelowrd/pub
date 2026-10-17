# Pick Up Boomers, slice the approved menu painting (2026-10-17, night)

The menu I want is the approved concept picture, the one you carry as `reference/approved-menu-concept.png` in the Grand Prix pack and as `reference/02-approved-menu.png` in the fidelity kit (1448 x 1086, BITTERSWEET SUNSET on the tube). Everything in it: the textured black TV with its chamfered rim and feet, the radio's finish, the key wells, the dark glass DRIVE key with its red glow, the dot matrix LCD lettering, the pixel heading, the counter up in the right corner. The one thing still open is the level meter; either version is fine for now.

The two packs since then went the other way. The Grand Prix pack rebuilt the picture in vector pieces and lost its material. The fidelity kit flattened it further on purpose. I do not want a third interpretation. I want the painting itself, cut into the pieces the game needs, in exactly its finish. Where a piece cannot be cut because lettering or light is baked in, repaint it in the same finish; do not redraw it in a cleaner style.

## Geometry stays

Keep every rectangle from `hardware-contract.json` (same as the Grand Prix `component-contracts.json`): desktop canvas 1280 x 960, TV at 200,20 size 880 x 660, radio at 80,690 size 1120 x 256, the control rects and hit rects, the 988 x 742 tube curve. Portrait 390 x 844 and landscape 740 x 340 likewise. The painting already fits that grid; the TV in it is the 988 x 742 tube. Nothing moves, no presets come back, no new controls.

## What I need, per layout (desktop, portrait, landscape)

1. TV shell. The painting's TV with the tube aperture transparent along the 988 x 742 curve. Keep the grain, the rim light, the chamfer, the mounts and the feet. Export at 1x and 2x (desktop 880 x 660 and 1760 x 1320).
2. Tube layer. The glass reflection, scanlines and corner shading as one transparent layer over the tube bounds, matching the painting's look on the picture, logo and text. One layer, so I do not stack passes.
3. Radio body. The fascia with empty key wells, an empty LCD (no text, no meter bars), the plaque lettering as painted. 1120 x 256 at 1x, plus 2x.
4. Keys. One file per control at its rect, in five states: rest, hover, pressed, selected, disabled. Labels painted in, in the painting's cream, amber with the light bar when selected (as SOLO RUN is in the picture), dimmed when disabled. SOLO RUN, CHALLENGE, MY RUNS, HIGH-SCORES, BACK, ENTER, PREV, NEXT, VOL with its minus and plus, the power glyph, MUTE, WALLET, SYSTEM. A focus bracket per rect, or one I can scale.
5. Red key. The dark glass lens with the red glow, blank, in rest, hover, pressed and disabled (glow off). The words as separate transparent legends in the LCD lettering: DRIVE, SHOT, COLLECT, CONNECT, WAIT, plus CONFIRM and FINISH. If the lettering is a font, the font file does instead of legends.
6. LCD font. The purpose line in the painting reads like the PUB Stereo LCD you cut for the Grand Prix pack. Confirm it is that font, or send the one it is.
7. Heading, metadata and counter fonts. BITTERSWEET SUNSET, WATERFRONT SUNSET CLEAR, 09 / 13 as painted. Name the fonts or send the files with licences. If they were painted without a font, choose the closest upright pixel face and send it; Boomer GT is slanted and Chakra Petch is smooth, neither is the picture.
8. Meter. The painting's five rising bars as a bed plus bar sprites, or the six by eight segment grid; your call, send the pieces.
9. Logo. The restored compact mark from the fidelity kit is right, keep it.
10. Icons. The Grand Prix location, sunset and clear icons are fine.
11. Three boards assembled only from these slices and fonts, at 1280 x 960, 390 x 844 and 740 x 340, showing stage 09. They should be indistinguishable from the painting on desktop. That is the test.

## Formats

Transparent PNG, 1x and 2x, top left anchored, plus a JSON of rects (reuse `hardware-contract.json`). No SVG rebuilds. Behaviour, copy, stage previews and the results screen are unchanged from the Grand Prix pack.
