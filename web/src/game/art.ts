// The designer's sheets (v3 arcade batch): equal cells, a fixed anchor per cell, and a pixels-per-metre scale per
// sheet taken from the visible bounds and world sizes in atlas-metadata.json. Draw whole cells at the anchor.
import type { District } from "./sim";
import type { Station, TimeOfDay } from "./stations";

export interface Sheet { file: string; cw: number; ch: number; cols: number; ax: number; ay: number; ppm: number }
const SH = (file: string, cw: number, ch: number, cols: number, ax: number, ay: number, ppm: number): Sheet => ({ file, cw, ch, cols, ax, ay, ppm });

export const SHEETS = {
  hero: SH("car-poses.webp", 724, 724, 3, 362, 565, 329), // left, straight, right
  heroBrake: SH("hero-brake.webp", 724, 724, 3, 362, 565, 329),
  heroSpin: SH("hero-spin.webp", 724, 724, 4, 362, 565, 255), // 8 directions, rear first, clockwise
  // traffic: 3 yaws (left, straight, right) x 2 rows (normal, brake); index = yaw + (brake ? 3 : 0)
  suv: SH("traffic-suv.webp", 724, 724, 3, 362, 565, 257),
  sedan: SH("traffic-sedan.webp", 724, 724, 3, 362, 565, 290),
  rv: SH("traffic-rv.webp", 724, 724, 3, 362, 565, 166),
  convertible: SH("traffic-convertible.webp", 724, 724, 3, 362, 565, 305),
  van: SH("traffic-van.webp", 724, 724, 3, 362, 565, 238),
  bus: SH("traffic-bus.webp", 724, 724, 3, 362, 565, 192),
  pickup: SH("traffic-pickup.webp", 724, 724, 3, 362, 565, 255), // track signatures: PICKUP TRUCK's truck, NEON PURSUIT's taxi
  taxi: SH("traffic-taxi.webp", 724, 724, 3, 362, 565, 300),
  cone: SH("cone.webp", 512, 512, 1, 256, 460, 573),
  oil: SH("oil.webp", 512, 512, 1, 256, 460, 195), // pre-squashed ground sprite
  pothole: SH("pothole.webp", 512, 512, 1, 256, 460, 299),
  barrier: SH("barrier.webp", 512, 512, 1, 256, 460, 187),
  smoke: SH("skid-smoke.webp", 512, 512, 3, 256, 460, 150), // 6 frames
  burst: SH("wreck-burst.webp", 724, 724, 1, 362, 660, 220),
  venues: SH("scenery-venues.webp", 512, 512, 4, 256, 460, 28), // school, nursing-home, aquagym, bar, bingo, arcade, market, garage
  props: SH("scenery-props.webp", 512, 512, 4, 256, 460, 50), // palm, broadleaf, cypress, jacaranda, agave, hedge, lamp, shelter; ppm per prop below
  people: SH("passengers.webp", 256, 384, 4, 128, 384, 211), // the first 16 characters by atlasIndex, waving
  peopleB: SH("passengers-b.webp", 512, 512, 4, 256, 466, 209), // characters with atlasSet b
  peopleC: SH("passengers-c.webp", 512, 512, 4, 256, 466, 209), // atlasSet c
  buildings: SH("buildings-atlas.webp", 1024, 768, 2, 512, 708, 60), // casino, cruise, golf, restaurant; ppm per building below
  dprops: SH("props-atlas.webp", 512, 512, 4, 256, 468, 200), // destination props; ppm per prop below
  dropDowntown: SH("dropoff-restaurant.png", 300, 150, 1, 150, 150, 60),
  dropWaterfront: SH("dropoff-cruise.png", 300, 150, 1, 150, 150, 60),
  dropCasino: SH("dropoff-casino.png", 300, 150, 1, 150, 150, 60),
  dropGolf: SH("dropoff-golf.png", 300, 150, 1, 150, 150, 60),
};
export const TRAFFIC: Sheet[] = [SHEETS.suv, SHEETS.sedan, SHEETS.rv, SHEETS.convertible, SHEETS.van, SHEETS.bus, SHEETS.pickup, SHEETS.taxi]; // by Traffic.kind (stations.ts feel.cars)
export const VENUE_CELL: Record<string, number> = { school: 0, "nursing-home": 1, aquagym: 2, bar: 3, bingo: 4, arcade: 5, market: 6, garage: 7 };
// prop cell and its own pixels per metre (a palm is 8 m tall, a hedge 4 m wide)
export const PROP = { palm: [0, 49], broadleaf: [1, 45], cypress: [2, 56], jacaranda: [3, 40], agave: [4, 160], hedge: [5, 107], lamp: [6, 54], shelter: [7, 89] } as const;
export const TREES: Record<District, (keyof typeof PROP)[]> = { downtown: ["broadleaf", "jacaranda"], waterfront: ["palm", "agave"], casino: ["jacaranda", "palm"], golf: ["cypress", "hedge"] };
export const PEOPLE: Record<string, Sheet> = { a: SHEETS.people, b: SHEETS.peopleB, c: SHEETS.peopleC };
// destination building: cell, pixels per metre (visible height / world height), the first painted column of its ground
// floor (the cells are painted edge to edge, so the renderer stands each building by that edge, clear of the bay)
export const BUILDING: Record<District, [number, number, number]> = { casino: [0, 62, 63], waterfront: [1, 39, 40], golf: [2, 71, 40], downtown: [3, 70, 40] };
export const DPROP: Record<string, [number, number]> = { "casino-fountain": [0, 168], "gold-palm-planter": [1, 183], "slot-machine": [2, 209], "mooring-bollard": [3, 428], yacht: [4, 102], "luggage-trolley": [5, 219], "golf-cart": [6, 211], "fairway-fence": [7, 286], sprinkler: [8, 360], "valet-podium": [9, 365], "velvet-rope": [10, 309], "spiral-topiary": [11, 175] };
export const DPROPS: Record<District, string[]> = { casino: ["casino-fountain", "gold-palm-planter", "slot-machine"], waterfront: ["mooring-bollard", "yacht", "luggage-trolley"], golf: ["golf-cart", "fairway-fence", "sprinkler"], downtown: ["valet-podium", "velvet-rope", "spiral-topiary"] };
// handoff 05: district skylines (sky painted in code), painted portals, light heads
export const PANO: Record<District, string> = { waterfront: "pano-waterfront.webp", casino: "pano-casino.webp", downtown: "pano-downtown.png", golf: "pano-golf.png" };
export const PANO_HORIZON = 725 / 887; // the horizon row of the 1774x887 panoramas
// tunnel kit: one shared two-mouth structure per fork, chosen by the street you're on; wall and ceiling materials; glow cookies
export const FORK_STRUCT: Record<District, string> = { waterfront: "harbour-causeway", downtown: "tower-podium", casino: "highway-overpass", golf: "wooded-ridge" };
// world lighting pack: the night art keeps its names, the midday and sunset repaints of the skylines, the venues, the
// destinations and the fork structures carry the light's suffix; the roadside frontage and the water exist in all three
const DAY_ART = new Set<string>([...Object.values(PANO), "scenery-venues.webp", "buildings-atlas.webp", ...Object.values(FORK_STRUCT).map((st) => `fork-${st}.webp`)]);
export const lit = (file: string, t: TimeOfDay) => (t === "night" || !DAY_ART.has(file) ? file : file.replace(/\.(webp|png)$/, `-${t}.webp`));
/** The frontage band beside the road: a 2048 x 512 right-side elevation per district, its pixels per metre (the designer's
 *  calibration: a 1.1 m promenade rail, 2.2 m doors) and how far behind the sidewalk it stands */
export const FRONTAGE: Record<District, [number, number]> = { waterfront: [88, 7], downtown: [36, 9], casino: [16, 9], golf: [83, 7] };
export const frontage = (d: District, t: TimeOfDay) => `frontage-${d}-${t}.webp`, water = (t: TimeOfDay) => `water-${t}.webp`;
export const lightFiles = (t: TimeOfDay) => [...[...DAY_ART].map((f) => lit(f, t)), ...(Object.keys(FRONTAGE) as District[]).map((d) => frontage(d, t)), water(t)];
/** The art folder and the three portrait sheets, shared by every screen that draws a face */
export const ART = `${import.meta.env.BASE_URL}art/`;
export const PORTRAITS: Record<string, string> = { a: "portraits.webp", b: "portraits-b.webp", c: "portraits-c.webp" };
export const TUNNEL = { wall: "tunnel-wall.webp", ceiling: "tunnel-ceiling.webp", headlight: "headlight.webp" };
export const LIGHT_RED = SH("light-red.webp", 512, 1024, 1, 256, 980, 600), LIGHT_GREEN = SH("light-green.webp", 512, 1024, 1, 256, 980, 600);
// road material tints (source-atop on the asphalt only)
export const ROAD_TINT: Record<District, [string, number]> = { waterfront: ["#175e79", 0.12], downtown: ["#655071", 0.12], casino: ["#7d285f", 0.14], golf: ["#2c6255", 0.12] };
export const DROP: Record<District, Sheet> = { downtown: SHEETS.dropDowntown, waterfront: SHEETS.dropWaterfront, casino: SHEETS.dropCasino, golf: SHEETS.dropGolf };
export const ICON: Record<District, string> = { downtown: "destination-restaurant.png", waterfront: "destination-cruise.png", casino: "destination-casino.png", golf: "destination-golf.png" };
export const TITLE = "title-scene.webp";

const images = new Map<string, HTMLImageElement>();
export const img = (file: string) => images.get(file);

// the painted gantry (menu kit): one frame across the road, a plate per branch with the district's trim, a rider badge
export const GANTRY = { frame: "gantry/frame.webp", hangers: "gantry/hangers.png", plate: "gantry/sign-plate.webp", badge: "gantry/badge-plate.png", trim: { waterfront: "gantry/trim-waterfront.png", downtown: "gantry/trim-downtown.png", casino: "gantry/trim-casino-strip.png", golf: "gantry/trim-golf-hills.png" } as Record<District, string> };
// street furniture (menu kit): eight props per district in one 4 x 2 sheet, ground anchor 256,460, each with its own scale
const DC = (file: string, ppm: number[]) => ({ sheet: SH(file, 512, 512, 4, 256, 460, 1), ppm });
export const DECOR: Record<District, { sheet: Sheet; ppm: number[] }> = {
  waterfront: DC("props-waterfront.webp", [221, 141, 177, 209, 236, 224, 176, 118]), // bench, map kiosk, lifebuoy cabinet, bins, deckchair cart, winch, estate car, shelter
  downtown: DC("props-downtown.webp", [115, 386, 283, 170, 118, 192, 157, 132]), // shelter, hydrant, newspaper boxes, phone booth, clock, planter, coupe, billboard
  casino: DC("props-casino-strip.webp", [260, 202, 141, 212, 326, 133, 207, 125]), // bench, vending, parasol, flamingo, bollard, limousine, planter, pylon
  golf: DC("props-golf-hills.webp", [237, 151, 303, 249, 223, 249, 172, 159]), // bench, timber shelter, ball washer, urn, heron, bin, estate car, fence
};

// district materials (visual update): a 512 px asphalt tile and a verge tile per district, projected on the road in world
// space; one soft contact shadow under everything that stands on the ground
const MAT = (d: string) => ({ asphalt: `materials/${d}-asphalt-repeat.webp`, verge: `materials/${d}-verge-repeat.webp` });
export const MATERIALS: Record<District, { asphalt: string; verge: string }> = { waterfront: MAT("waterfront"), downtown: MAT("downtown"), casino: MAT("casino-strip"), golf: MAT("golf-hills") };
export const SHADOW = "materials/contact-shadow.webp";


// track signatures (brief 9): one look per song. The lamps are one 512 x 1024 sheet per hour (waterfront, downtown,
// casino strip, then the factory's sodium pole at night) and a 512 px bollard sheet for the golf hills (midday, sunset,
// night); pixels per metre from the painted heights (8.5, 8.7, 9, 8 m; the bollard 1.2 m)
export const LAMPS: Record<TimeOfDay | "golf", Sheet> = { midday: SH("songs/lamps-midday.webp", 512, 1024, 4, 256, 980, 1), sunset: SH("songs/lamps-sunset.webp", 512, 1024, 4, 256, 980, 1), night: SH("songs/lamps-night.webp", 512, 1024, 4, 256, 980, 1), golf: SH("songs/lamps-golf.webp", 512, 512, 4, 256, 460, 1) };
/** A sheet cell and its pixels per metre: one piece of a song's look */
export type Piece = [Sheet, number, number, number?]; // sheet, cell, pixels per metre, frames (two for the neon billboards and the tube man)
const LAMP_CELL: Record<Exclude<District, "golf">, [number, number]> = { waterfront: [0, 111.5], downtown: [1, 109], casino: [2, 105.3] };
export function lampOf(d: District, t: TimeOfDay, song: string): Piece {
  if (d === "golf") return [LAMPS.golf, ["midday", "sunset", "night"].indexOf(t), 356.7];
  if (song === "abandoned-factory" && d === "downtown") return [LAMPS.night, 3, 118.5];
  return [LAMPS[t], ...LAMP_CELL[d]];
}
const P4 = (file: string, cols = 4) => SH(`songs/${file}`, 512, 512, cols, 256, 460, 1), T4 = (file: string) => SH(`songs/${file}`, 512, 1024, 4, 256, 980, 1);
const orangeProps = P4("orange-props.webp"), factoryProps = P4("factory-props.webp"), chaseProps = P4("chase-props.webp"), outrunProps = P4("outrun-props.webp"), pickupProps = P4("pickup-props.webp"), darkProps = P4("dark-props.webp"), bittersweetProps = P4("bittersweet-props.webp"), cruiseProps = P4("cruise-props.webp"), crushProps = P4("crush-props.webp");
const factoryTall = T4("factory-tall.webp"), chaseTall = T4("chase-tall.webp"), outrunTall = T4("outrun-tall.webp"), vectorTall = T4("vector-tall.webp"), pickupTall = T4("pickup-tall.webp"), cruiseTall = T4("cruise-tall.webp");
export const BILLBOARDS = [P4("billboard-a.webp", 2), P4("billboard-b.webp", 2)], BILLBOARD_PPM = 77.3; // two neon frames each
export const TUBE_MAN = P4("tube-man.webp", 2), TUBE_PPM = 63.3; // two flapping frames
export const BEACON = SH("songs/beacon.webp", 96, 96, 1, 48, 48, 1), ANTENNA_TIP = [255, 51], LAMP_ROOM = [256, 193]; // the mast's tip and the lighthouse's lamp room in their 512 x 1024 cells
export const GATE = "songs/neon-gate.webp"; // 2048 x 1024, the road passes between x 664 and 1384, the ground row is 928
export const SKY_ART = { moon: "songs/moon.webp", helicopter: "songs/helicopter.webp", gull: "songs/gull.webp", blimp: "songs/blimp.webp", ferris: ["songs/ferris-structure.webp", "songs/ferris-wheel.webp"], balloons: ["songs/balloon-1.webp", "songs/balloon-2.webp", "songs/balloon-3.webp"] };
/** What a song puts beside the road: its props in the furniture slots (every 55 m), its tall pieces in the tree slots, its
 *  curb pair and dash colour, how far apart its lamps stand (segments), and the files to fetch with it */
export interface Look { props?: Piece[]; tall?: Piece[]; curbs?: [string, string]; dash?: string; lampGap?: number; files: string[]; noMirror?: Set<number> }
const L = (look: Omit<Look, "files"> & { sky?: string[] }): Look => {
  const sheets = new Set<string>([...(look.props ?? []), ...(look.tall ?? [])].map(([sh]) => sh.file));
  return { ...look, files: [...sheets, ...(look.sky ?? [])] };
};
export const LOOK: Record<string, Look> = {
  "nocturnal-run": L({ curbs: ["#f4f4f0", "#ffd36a"], sky: [SKY_ART.moon] }),
  "synthwave-engine": L({ props: [[BILLBOARDS[0], 0, BILLBOARD_PPM, 2], [BILLBOARDS[1], 0, BILLBOARD_PPM, 2]], curbs: ["#59e6ff", "#ff4fd0"], dash: "#8ff4ff" }),
  "abandoned-factory": L({ props: [[factoryProps, 0, 166.8], [factoryProps, 1, 267.5], [factoryProps, 2, 80]], tall: [[factoryTall, 0, 43.1]], curbs: ["#8a8a90", "#e6c330"] }),
  "midnight-chase": L({ props: [[chaseProps, 0, 57.1]], tall: [[chaseTall, 0, 79]], curbs: ["#f4f4f8", "#ff3a4a"], sky: [SKY_ART.helicopter, BEACON.file] }),
  "outrun-pulse": L({ props: [[outrunProps, 0, 80.6], [outrunProps, 1, 98.8]], tall: [[outrunTall, 0, 54.7]], curbs: ["#ff3b3b", "#f8f8f8"], sky: [SKY_ART.gull] }),
  "vector-world": L({ tall: [[vectorTall, 0, 47.4], [vectorTall, 1, 52.7], [vectorTall, 2, 52.7]], curbs: ["#62f3a4", "#f962d3"], dash: "#7cfff0", sky: [SKY_ART.blimp] }),
  "pickup-truck": L({ props: [[pickupProps, 0, 220.8], [pickupProps, 1, 186.9], [pickupProps, 2, 125.6]], tall: [[pickupTall, 0, 74.4]] }),
  "dark-horse": L({ props: [[darkProps, 2, 89.2], [darkProps, 3, 267.5]], tall: [[darkProps, 0, 46.6], [darkProps, 1, 58.9]], curbs: ["#8c8ca0", "#9a6a86"] }),
  "bittersweet-sunset": L({ props: [[bittersweetProps, 0, 160], [bittersweetProps, 1, 147.6]], sky: SKY_ART.ferris }),
  "neon-pursuit": L({ sky: [GATE] }),
  "orange-horizon": L({ props: [[orangeProps, 1, 124]], tall: [[orangeProps, 0, 44.4]], curbs: ["#ffd9a0", "#e8a141"], sky: SKY_ART.balloons }),
  "night-cruise": L({ props: [[cruiseProps, 0, 115], [cruiseProps, 1, 92.2]], tall: [[cruiseTall, 0, 39.5]], curbs: ["#8bace5", "#d8e2f4"], lampGap: 16, sky: [SKY_ART.moon] }),
  "pick-up-or-crush-up": L({ props: [[crushProps, 0, 158.1], [crushProps, 1, 150], [crushProps, 2, 270.8], [crushProps, 3, 198], [TUBE_MAN, 0, TUBE_PPM, 2]], curbs: ["#f3ce45", "#1c1c20"], noMirror: new Set([0]) }),
};
/** A song's look: its sheets and sky pieces, plus the hour's lamps (every district can be crossed) */
export const loadLook = (st: Station) => loadFiles([...(LOOK[st.id]?.files ?? []), LAMPS[st.time].file, LAMPS.golf.file]);

/** The night world and everything else the game draws, up front behind the loading bar */
export function loadArt(onProgress?: (done: number, total: number) => void): Promise<void> {
  return loadFiles([...Object.values(SHEETS).map((s) => s.file), ...Object.values(ICON), ...Object.values(PANO), ...Object.values(FORK_STRUCT).flatMap((st) => [`fork-${st}.webp`, `fork-${st}-left.png`, `fork-${st}-right.png`]), ...Object.values(TUNNEL), LIGHT_RED.file, LIGHT_GREEN.file, TITLE, GANTRY.frame, GANTRY.hangers, GANTRY.plate, GANTRY.badge, ...Object.values(GANTRY.trim), ...Object.values(DECOR).map((d) => d.sheet.file), ...Object.values(MATERIALS).flatMap((m) => [m.asphalt, m.verge]), SHADOW], onProgress);
}
/** A stage's light: its repaints and bands, fetched when the run starts (a third of the world per light, so not up front) */
export const loadLight = (t: TimeOfDay) => loadFiles(lightFiles(t));
function loadFiles(list: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  const files = new Set(list.filter((f) => !images.has(f)));
  let done = 0;
  return Promise.all([...files].map((file) => new Promise<void>((ok, bad) => {
    const im = new Image();
    im.src = `${import.meta.env.BASE_URL}art/${file}`;
    // decode now: a 2048 px sheet decoded on its first draw costs a frame of half a second
    im.decode().then(() => { images.set(file, im); onProgress?.(++done, files.size); ok(); }, () => bad(new Error(`art: ${file}`)));
  }))).then(() => undefined);
}
