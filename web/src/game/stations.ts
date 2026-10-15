// The radio: thirteen level tracks (each ~3:00, the song is the run), moods from docs/designer-brief.md.
// Omotesando (original tempo) is the menu track and off the dial; Boomers is kept in temp/ but unused for now.
export interface Station { id: string; title: string; mood: string }
export const STATIONS: Station[] = [
  { id: "abandoned-factory", title: "ABANDONED FACTORY", mood: "DARK INDUSTRIAL" },
  { id: "bittersweet-sunset", title: "BITTERSWEET SUNSET", mood: "WISTFUL GOLDEN HOUR" },
  { id: "dark-horse", title: "DARK HORSE", mood: "UNDERDOG GRIT" },
  { id: "midnight-chase", title: "MIDNIGHT CHASE", mood: "FLIRTY SLOW CHASE" },
  { id: "neon-pursuit", title: "NEON PURSUIT", mood: "TUNNEL-LIGHT RUSH" },
  { id: "night-cruise", title: "NIGHT CRUISE", mood: "LAID-BACK CRUISING" },
  { id: "nocturnal-run", title: "NOCTURNAL RUN", mood: "SLEEK AFTER DARK" },
  { id: "orange-horizon", title: "ORANGE HORIZON", mood: "STORM TO GLORY" },
  { id: "outrun-pulse", title: "OUTRUN PULSE", mood: "CLASSIC ARCADE DRIVE" },
  { id: "pick-up-or-crush-up", title: "PICK UP OR CRUSH UP", mood: "CHEEKY MAYHEM" },
  { id: "pickup-truck", title: "PICKUP TRUCK", mood: "HARD-WON TRIUMPH" },
  { id: "synthwave-engine", title: "SYNTHWAVE ENGINE", mood: "REVVING RETRO" },
  { id: "vector-world", title: "VECTOR WORLD", mood: "WIREFRAME COOL" },
];
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
