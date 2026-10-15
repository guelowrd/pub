# Pick Up Boomers, next phases for the designer (2026-10-15, late)

Your last two packs are in the game: the radio face runs as delivered in all three layouts, the fork structures hold both mouths, the tunnels use your wall and ceiling materials with code lighting, the four skylines sit behind song-coloured skies, the fillers line the streets, and every number is Boomer LCD, every word Boomer GT. Nothing from those packs is waiting on me.

What comes next, in the order I need it.

## 1. The head unit: one menu for everything

The radio face becomes the whole menu system, in the style of the Testarossa's original head unit (reference: `GrandPrixFace-3_1800x1800.webp`, the electronic GRAND PRIX): black fascia, six preset keys, MODE, FREQ/BAND, two pairs of arrows, a VOL rocker, an AUTO rocker, power, AUDIO, SYSTEM, MUTE, and a segment display. Keep that physical layout and our palette and fonts. Everything the player does outside driving happens on this one face:

- RADIO: tune the station and DRIVE (what you already designed, folded into this unit).
- RECORDS: the board of open records. Each row: the champion, the score to beat, the prize, the course and station, time left. Pick one and take a SHOT for a stake: the same course and song, your score must beat theirs.
- POST: after a run, set a prize and post the score as a record.
- HISTORY: my records and my shots, with their state (open, beaten, won, expired, collectable) and COLLECT.
- SCORES: the high score table.
- WALLET: connect, balance in Gamecoin, network, pending transaction, error.
- AUDIO and SYSTEM: sound and volume, settings.

The display is the problem to solve: the real unit has one line. The menus need a list of four to six rows plus a title line, so either the display grows to a double-height panel inside the same fascia or the unit gets a second DIN slot above it for the list. Your call. Long rows can scroll like the radio title. The preset keys 1 to 6 can be the six modes, MODE cycles them, the arrows move and pick, the key shows which mode lights.

Deliver it like the radio: separate layers per control, blank faces, pressed and lit states, three layouts (1280x960, 390x844, 740x340), fixed anchors and hit rects in JSON, display clip boxes and baselines for Boomer LCD. Any copy beyond the mode names stays mine.

## 2. Gantry sign kit

The fork signs are code-drawn today. I need a painted gantry: the frame across the road, two sign plates with a slot for the district name, a slot for the destination icon, and a badge plate for the riders-aboard count. Separate layers, equal cells, fixed anchors, text-free.

## 3. Decor variety

Each district reads right now but repeats fast. Six to eight more street props per district in the existing 512 cell format with fixed ground anchors: benches, kiosks, billboards, hydrants, parked cars seen from behind, planters, signs, fences, bus shelters in the district's style. No new venues, no stop markers.

## 4. Ship kit

A share card for a finished run at 1200x630 with slots for the score, the station and the three portraits; an app icon and favicon set; a loading screen that matches the splash.

## Housekeeping

Each pack still ships `.partial` leftovers. Please drop them before zipping.
