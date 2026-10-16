// The designer's sheets (v3 arcade batch): equal cells, a fixed anchor per cell, and a pixels-per-metre scale per
// sheet taken from the visible bounds and world sizes in atlas-metadata.json. Draw whole cells at the anchor.
import type { District } from "./sim";

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
export const TRAFFIC: Sheet[] = [SHEETS.suv, SHEETS.sedan, SHEETS.rv, SHEETS.convertible, SHEETS.van, SHEETS.bus]; // by Traffic.kind
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
// handoff 05: district skylines (sky painted in code), decorative fillers, painted portals, light heads
export const PANO: Record<District, string> = { waterfront: "pano-waterfront.webp", casino: "pano-casino.webp", downtown: "pano-downtown.png", golf: "pano-golf.png" };
export const PANO_HORIZON = 725 / 887; // the horizon row of the 1774x887 panoramas
const FL = (file: string, ppm: number) => SH(file, 512, 512, 1, 256, 460, ppm); // visible height / world height
export const FILLERS: Record<District, Sheet[]> = {
  waterfront: [FL("filler-waterfront-1.webp", 36), FL("filler-waterfront-2.webp", 45), FL("filler-waterfront-3.webp", 83)],
  downtown: [FL("filler-downtown-1.webp", 62), FL("filler-downtown-2.webp", 51), FL("filler-downtown-3.webp", 72)],
  casino: [FL("filler-casino-strip-1.webp", 66), FL("filler-casino-strip-2.webp", 30), FL("filler-casino-strip-3.webp", 83)],
  golf: [FL("filler-golf-hills-1.webp", 38), FL("filler-golf-hills-2.webp", 21), FL("filler-golf-hills-3.webp", 55)],
};
// tunnel kit: one shared two-mouth structure per fork, chosen by the street you're on; wall and ceiling materials; glow cookies
export const FORK_STRUCT: Record<District, string> = { waterfront: "harbour-causeway", downtown: "tower-podium", casino: "highway-overpass", golf: "wooded-ridge" };
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

export function loadArt(onProgress?: (done: number, total: number) => void): Promise<void> {
  const files = new Set<string>([...Object.values(SHEETS).map((s) => s.file), ...Object.values(ICON), ...Object.values(PANO), ...Object.values(FILLERS).flat().map((s) => s.file), ...Object.values(FORK_STRUCT).flatMap((st) => [`fork-${st}.webp`, `fork-${st}-left.png`, `fork-${st}-right.png`]), ...Object.values(TUNNEL), LIGHT_RED.file, LIGHT_GREEN.file, TITLE, GANTRY.frame, GANTRY.hangers, GANTRY.plate, GANTRY.badge, ...Object.values(GANTRY.trim), ...Object.values(DECOR).map((d) => d.sheet.file), ...Object.values(MATERIALS).flatMap((m) => [m.asphalt, m.verge]), SHADOW]);
  let done = 0;
  return Promise.all([...files].map((file) => new Promise<void>((ok, bad) => {
    const im = new Image();
    im.src = `${import.meta.env.BASE_URL}art/${file}`;
    // decode now: a 2048 px sheet decoded on its first draw costs a frame of half a second
    im.decode().then(() => { images.set(file, im); onProgress?.(++done, files.size); ok(); }, () => bad(new Error(`art: ${file}`)));
  }))).then(() => undefined);
}
