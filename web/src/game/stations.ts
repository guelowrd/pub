import type { District } from "./sim";

// The radio: thirteen level tracks (each ~3:00, the song is the run), moods from docs/designer-brief.md.
// Omotesando (original tempo) is the menu track and off the dial; Boomers is kept in temp/ but unused for now.
export type TimeOfDay = "midday" | "sunset" | "night";
/** A song is a stage: where the run starts, the light and the weather (the designer's table, 2026-10-16). */
export interface Station { id: string; title: string; mood: string; district: District; time: TimeOfDay; rain: boolean }
export const STATIONS: Station[] = [
  { id: "nocturnal-run", title: "NOCTURNAL RUN", mood: "SLEEK AFTER DARK", district: "golf", time: "night", rain: false },
  { id: "synthwave-engine", title: "SYNTHWAVE ENGINE", mood: "REVVING RETRO", district: "downtown", time: "sunset", rain: false },
  { id: "abandoned-factory", title: "ABANDONED FACTORY", mood: "DARK INDUSTRIAL", district: "downtown", time: "night", rain: true },
  { id: "midnight-chase", title: "MIDNIGHT CHASE", mood: "FLIRTY SLOW CHASE", district: "downtown", time: "night", rain: false },
  { id: "outrun-pulse", title: "OUTRUN PULSE", mood: "CLASSIC ARCADE DRIVE", district: "waterfront", time: "midday", rain: false },
  { id: "vector-world", title: "VECTOR WORLD", mood: "WIREFRAME COOL", district: "casino", time: "sunset", rain: false },
  { id: "pickup-truck", title: "PICKUP TRUCK", mood: "HARD-WON TRIUMPH", district: "golf", time: "midday", rain: false },
  { id: "dark-horse", title: "DARK HORSE", mood: "UNDERDOG GRIT", district: "golf", time: "night", rain: true },
  { id: "bittersweet-sunset", title: "BITTERSWEET SUNSET", mood: "WISTFUL GOLDEN HOUR", district: "waterfront", time: "sunset", rain: false },
  { id: "neon-pursuit", title: "NEON PURSUIT", mood: "TUNNEL-LIGHT RUSH", district: "casino", time: "night", rain: true },
  { id: "orange-horizon", title: "ORANGE HORIZON", mood: "STORM TO GLORY", district: "golf", time: "sunset", rain: false },
  { id: "night-cruise", title: "NIGHT CRUISE", mood: "LAID-BACK CRUISING", district: "waterfront", time: "night", rain: false },
  { id: "pick-up-or-crush-up", title: "PICK UP OR CRUSH UP", mood: "CHEEKY MAYHEM", district: "casino", time: "midday", rain: false },
];
export const DISTRICT_NAME: Record<District, string> = { downtown: "DOWNTOWN", waterfront: "WATERFRONT", casino: "CASINO STRIP", golf: "GOLF HILLS" };
export const MENU_TRACK = "omotesando-menu", RESULTS_TRACK = "wireline-cosmos";
// the song owns the sky: top and bottom of the gradient behind the district's skyline
export const SKY: Record<string, [string, string]> = {
  "abandoned-factory": ["#0b0b14", "#4a3a50"], "bittersweet-sunset": ["#2a1452", "#ff8c5a"], "dark-horse": ["#0a0820", "#5a2a6e"],
  "midnight-chase": ["#120a2e", "#8a2a9e"], "neon-pursuit": ["#0c1030", "#2a60c0"], "night-cruise": ["#0a1030", "#3050a0"],
  "nocturnal-run": ["#06061a", "#4a2a7a"], "orange-horizon": ["#3a1240", "#ff7a30"], "outrun-pulse": ["#14102e", "#bc448e"],
  "pick-up-or-crush-up": ["#2a0a40", "#ff40bd"], "pickup-truck": ["#3a3a7a", "#f0c090"], "synthwave-engine": ["#1a0a3a", "#d04aa0"],
  "vector-world": ["#030a18", "#1a6aa0"],
};
export const DEFAULT_SKY: [string, string] = ["#14102e", "#bc448e"];
// the song owns the car's paint too (visual update station-colours.json: 13 families for the 13 songs, silver left over)
export const CAR: Record<string, string> = {
  "abandoned-factory": "#141b22", "bittersweet-sunset": "#f77916", "dark-horse": "#805037", "midnight-chase": "#933fda", "neon-pursuit": "#1685ed",
  "night-cruise": "#32387f", "nocturnal-run": "#f5f3e6", "orange-horizon": "#bc8730", "outrun-pulse": "#e32636", "pick-up-or-crush-up": "#f074b8",
  "pickup-truck": "#cabb96", "synthwave-engine": "#f5d62a", "vector-world": "#24b657",
};
