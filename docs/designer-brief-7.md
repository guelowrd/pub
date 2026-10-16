# Pick Up Boomers, the stages in the driving scene (2026-10-16, night)

The TV shows thirteen stages. The road still drives through one night. Gaylord wants the run to look like its preview: water beside the road at the waterfront, facades close by downtown, neon fronts on the strip, stone walls in the hills, and the hour and the weather of the stage. This brief is the art that needs, in the formats the engine already loads. Everything the engine can do alone (sky, lamp glow, rain, wet road, an ambient tint) I am doing now and will send screenshots.

## What the engine draws today, per district

- One skyline panorama, 1774 x 887, horizon on row 725, painted for night (`pano-*`). The sky above it is a gradient drawn in code.
- Three roadside fillers, 512 x 512 sprites placed every so often, night (`filler-*`).
- Asphalt and verge tiles (`materials/*-repeat`), the destination building in `buildings-atlas`, the eight venues in `scenery-venues`, the trees, lamps and props, the fork portal (`fork-*`). All painted for night.
- Beside the road: a flat ground band in a dark colour, then the fillers and trees. No water, no continuous frontage.

Three lights exist on the dial: midday, sunset, night. Rain only at night. Districts change at forks; light and weather hold for the run.

## What I need, in order

1. **Daylight skylines.** The four panoramas at midday and at sunset: 8 files, 1774 x 887, horizon on row 725, the same framing and the same district landmarks as the night ones. Night rain stays the night panorama under a cloud veil, no new painting.
2. **Roadside frontage, one strip per district.** The thing that makes a district read: a continuous band that runs beside the road. Waterfront: promenade railing and bollards with the water behind. Downtown: ground floors and lobbies, towers above. Casino strip: neon fronts and porte-cochères. Golf hills: dry stone wall, hedge, cypresses. One seamless strip per district, 2048 x 512, tiling along the road, drawn for the right-hand side (I mirror it for the left), ground line at the bottom edge, transparent sky. Three lights each: 12 files. These replace the sparse fillers over time.
3. **Water.** A seamless water tile for the plane beside the waterfront road, 512 x 512, three lights: 3 files. I darken it for rain and lay your wet glints on the road.
4. **Daylight venues.** `buildings-atlas` (2048 x 1536, four destination buildings) and `scenery-venues` (512 x 512, eight venues) at midday and at sunset: 4 files. Windows unlit by day, signs off at midday, first lights at sunset.
5. **Daylight portals.** The four fork structures (`fork-*`, 2048 x 1024, with their left and right trim masks) at midday and at sunset: 8 files plus masks. Lowest priority; a tint can carry these for a while.

Props, trees, lamps, cars and people need nothing: the engine tints them, and the lamps' glow goes off by day.

## Facts you can rely on

- The thirteen stages and your previews are the reference for each district at each light. Match them.
- Transparent PNG or WebP, the sizes above. Pixel-per-metre scales stay as they are for the sheets you are replacing.
- Night versions of everything stay as they are. Rain is engine work on top of night.
- No new HUD, menu, results or TV exports.
