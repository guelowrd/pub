# Pick Up Boomers, where we are (2026-10-16)

Both of your last packs are in the game: the Visual Update and the Menu Fix. Screenshots of every screen as it runs today are in `docs/screens/` (01 to 18, splash to results). They are the truth of what I have, so work from them rather than from the earlier boards.

## Picks

- Menu B, Night Shift. The radio and menu look will be reviewed again later; it stays as is for now.
- Radar B, the portrait beside the reticle. The reticle is a position map: the blip sits on the curb side of the pickup (left or right) and climbs with the distance, centre when I am on it, top at 250 m. AGE RANGE under it.
- Arcade Dash fonts everywhere, padded five-digit scores, no mood line, body-only song paint, district road and verge materials, contact shadows.

## What is live from your packs

- The head unit on your geometry: blank face, the four key states, the label-free action key with the runtime label on your baseline (DRIVE, SHOT, COLLECT, CONNECT, GET GC, TRY AGAIN), your selection layer behind the rows, 13 ticks on the band, landscape at 16 px.
- The radar: your B shell, the 48-sample green dither on all 48 portraits, the search and CAR FULL shells.
- The gantry, the 32 props, the loading screen, the icons and the share template as the link preview (earlier kit).

## One structural change

The radio is a jukebox: pick the song, pick a record to shoot at, read the scores, change a setting. It is not the post-game menu. Posting a run now happens on the results screen (18-results-post.jpg): POST IT puts 1 GC on the record, then SHARE ON X and COPY LINK. One stake, one prize, 1 GC, like GeoQuizz. The head unit's presets are RADIO, RECORDS, SCORES, HISTORY, WALLET, SYSTEM; AUDIO keeps its key.

## Decisions I am applying in code today, so you can design on top of them

- The lower LCD shows the station index, the band and VOL in every mode: the radio keeps playing while I browse. Nothing else goes in it.
- POWER turns the unit off: back to the splash. FREQ/BAND seeks: it jumps to a random station.
- SCORES is one row per player, that player's best record.
- SYSTEM gets a RESET BEST row (clears the best score kept on the device).
- The radar scans while in a tunnel, instead of showing the next street's target.
- The HUD is hidden behind the results screen.
- The radar moves to the bottom right corner and the seats stay top right, so the right curb and the gantry's right plate stay visible mid-screen. This is my provisional layout until you redo the rail (item 2 below).

## What I need from you next, in order

1. The results screen. It is code-drawn today (TIME IS UP, three stat rows, the still-on-board box, the post box, SAME RUN and NEW RUN). It needs a design in the same family as the head unit: the score, the stats, the post box (one line, 1 GC) and the two share actions, the two run buttons, and the same screen after a shot (the verdict line and DRIVE AGAIN, TRY AGAIN, MENU). The HUD will be hidden under it.
2. The HUD's right rail. At close range the seats and the radar covered the right sidewalk, the bay and the gantry's right plate (11-drive-gantry.jpg). I need a composition that keeps the right curb visible: the seats as a thinner strip, the radar in a corner, or both smaller. The radar should not grow. My provisional layout (radar bottom right) is a stopgap.
3. HISTORY rows: a record icon and a shot icon in place of my R and S letters, and the state words in your colours (OPEN, IN PLAY, COLLECT, BEATEN, DEFENDED, TAKEN BACK, WON, LOST).
4. The pause overlay (15-pause.jpg): unstyled, just PAUSED and CLOCK STOPPED over the dimmed scene.
5. The radar's DROP OFF state: when the next stop is a drop-off bay, the reticle shows the bay's position and the text says DROP OFF with the destination icon. The copy and the layout are mine; give it a proper treatment, and one for the two-second reveal after a pickup (full-colour portrait, exact age, points to bank).
6. The share card at runtime: a downloadable 1200 x 630 image of a finished run with the score, the station and the three portraits, from your ship kit template. Tell me if anything in the template should change now that the fonts changed.
7. The splash: the rules ribbon and CLICK TO START now set in Chakra Petch. Check them against the chrome wordmark and say if the ribbon needs its own treatment.
8. Phone faces: I cannot check portrait and landscape on a device here, so treat the desktop screens as the only verified ones. If you can run the build on a phone, screenshots back would help.

## Facts you can rely on

- 13 songs, silver unused. Station order: ABANDONED FACTORY, BITTERSWEET SUNSET, DARK HORSE, MIDNIGHT CHASE, NEON PURSUIT, NIGHT CRUISE, NOCTURNAL RUN, ORANGE HORIZON, OUTRUN PULSE, PICK UP OR CRUSH UP, PICKUP TRUCK, SYNTHWAVE ENGINE, VECTOR WORLD. Paints in that order: black, orange, brown, violet, blue, indigo, white, gold, red, pink, beige, yellow, green.
- Three seats, one radar, the clock at the top left, the score at the top right, the speed at the bottom left. Nothing else in the HUD.
- Pose sheets, materials and portraits need no new exports.
