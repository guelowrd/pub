import type { District, HazardKind } from "./sim";

// The radio: thirteen level tracks (each ~3:00, the song is the run), moods from docs/designer-brief.md.
// Omotesando (original tempo) is the menu track and off the dial; Boomers is kept in temp/ but unused for now.
export type TimeOfDay = "midday" | "sunset" | "night";
/** How a song drives (Gaylord's moods, 2026-10-17, docs/set-dressing-plan.md): extra cars over the district's base, hazard
 *  rolls per street and the kinds they draw from, how much the curves and hills roll, how hard the crosswind leans in rain */
export interface Feel { traffic: number; hazards: number; mix: HazardKind[]; curves: number; hills: number; wind: number }
/** A song is a stage: where the run starts, the light and the weather (the designer's table, 2026-10-16), and its feel. */
export interface Station { id: string; title: string; mood: string; district: District; time: TimeOfDay; rain: boolean; feel: Feel }
const F = (traffic: number, hazards: number, mix: string, curves: number, hills: number, wind = 1): Feel => ({ traffic, hazards, mix: mix.split(" ") as HazardKind[], curves, hills, wind });
export const STATIONS: Station[] = [
  { id: "nocturnal-run", title: "NOCTURNAL RUN", mood: "SLEEK AFTER DARK", district: "golf", time: "night", rain: false, feel: F(0, 4, "cone oil", 1.0, 1.3) },
  { id: "synthwave-engine", title: "SYNTHWAVE ENGINE", mood: "REVVING RETRO", district: "downtown", time: "sunset", rain: false, feel: F(1, 7, "cone cone oil pothole", 1.2, 0.8) },
  { id: "abandoned-factory", title: "ABANDONED FACTORY", mood: "DARK INDUSTRIAL", district: "downtown", time: "night", rain: true, feel: F(1, 12, "pothole pothole barrier barrier oil", 0.9, 0.5, 1.4) },
  { id: "midnight-chase", title: "MIDNIGHT CHASE", mood: "FLIRTY SLOW CHASE", district: "downtown", time: "night", rain: false, feel: F(3, 6, "cone oil pothole", 1.3, 1.0) },
  { id: "outrun-pulse", title: "OUTRUN PULSE", mood: "CLASSIC ARCADE DRIVE", district: "waterfront", time: "midday", rain: false, feel: F(0, 5, "cone oil", 1.5, 0.4) },
  { id: "vector-world", title: "VECTOR WORLD", mood: "WIREFRAME COOL", district: "casino", time: "sunset", rain: false, feel: F(1, 9, "cone cone cone oil", 1.3, 1.3) },
  { id: "pickup-truck", title: "PICKUP TRUCK", mood: "HARD-WON TRIUMPH", district: "golf", time: "midday", rain: false, feel: F(1, 9, "pothole pothole barrier cone", 1.0, 1.8) },
  { id: "dark-horse", title: "DARK HORSE", mood: "UNDERDOG GRIT", district: "golf", time: "night", rain: true, feel: F(0, 7, "pothole oil barrier", 0.7, 1.8, 1.4) },
  { id: "bittersweet-sunset", title: "BITTERSWEET SUNSET", mood: "WISTFUL GOLDEN HOUR", district: "waterfront", time: "sunset", rain: false, feel: F(-1, 3, "cone oil", 0.9, 0.8) },
  { id: "neon-pursuit", title: "NEON PURSUIT", mood: "TUNNEL-LIGHT RUSH", district: "casino", time: "night", rain: true, feel: F(3, 10, "cone cone oil oil", 1.5, 0.6, 0.7) },
  { id: "orange-horizon", title: "ORANGE HORIZON", mood: "STORM TO GLORY", district: "golf", time: "sunset", rain: false, feel: F(0, 4, "cone pothole", 1.2, 1.5) },
  { id: "night-cruise", title: "NIGHT CRUISE", mood: "LAID-BACK CRUISING", district: "waterfront", time: "night", rain: false, feel: F(-2, 2, "cone", 0.7, 0.4) },
  { id: "pick-up-or-crush-up", title: "PICK UP OR CRUSH UP", mood: "CHEEKY MAYHEM", district: "casino", time: "midday", rain: false, feel: F(3, 12, "cone cone oil pothole barrier", 1.0, 1.0) },
];
export const MENU_TRACK = "omotesando-menu", RESULTS_TRACK = "wireline-cosmos";
// the song owns the sky: top and bottom of the gradient behind the district's skyline, at the stage's hour (the daylight
// skylines are painted under a #69bce2 to #d4e2dc midday and a #34347c to #ef9a6e sunset)
export const SKY: Record<string, [string, string]> = {
  "abandoned-factory": ["#0b0b14", "#4a3a50"], "bittersweet-sunset": ["#3a2a74", "#f8966a"], "dark-horse": ["#0a0820", "#5a2a6e"],
  "midnight-chase": ["#120a2e", "#8a2a9e"], "neon-pursuit": ["#0c1030", "#2a60c0"], "night-cruise": ["#0a1030", "#3050a0"],
  "nocturnal-run": ["#06061a", "#4a2a7a"], "orange-horizon": ["#44306e", "#f6904e"], "outrun-pulse": ["#4aa8e0", "#d2e4e0"],
  "pick-up-or-crush-up": ["#5eb0e6", "#e2dce8"], "pickup-truck": ["#66bce2", "#d4e6d8"], "synthwave-engine": ["#34347c", "#ef9a6e"],
  "vector-world": ["#2e3680", "#e8a078"],
};
export const DEFAULT_SKY: [string, string] = ["#14102e", "#bc448e"];
// the song owns the car's paint too (visual update station-colours.json: 13 families for the 13 songs, silver left over)
export const CAR: Record<string, string> = {
  "abandoned-factory": "#141b22", "bittersweet-sunset": "#f77916", "dark-horse": "#805037", "midnight-chase": "#933fda", "neon-pursuit": "#1685ed",
  "night-cruise": "#32387f", "nocturnal-run": "#f5f3e6", "orange-horizon": "#bc8730", "outrun-pulse": "#e32636", "pick-up-or-crush-up": "#f074b8",
  "pickup-truck": "#cabb96", "synthwave-engine": "#f5d62a", "vector-world": "#24b657",
};
