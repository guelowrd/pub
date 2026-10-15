// The radio: fourteen level tracks (each ~3:00, the song is the run), moods from docs/designer-brief.md.
export interface Station { id: string; title: string; mood: string }
export const STATIONS: Station[] = [
  { id: "abandoned-factory", title: "ABANDONED FACTORY", mood: "DARK INDUSTRIAL" },
  { id: "bittersweet-sunset", title: "BITTERSWEET SUNSET", mood: "WISTFUL GOLDEN HOUR" },
  { id: "dark-horse", title: "DARK HORSE", mood: "UNDERDOG GRIT" },
  { id: "midnight-chase", title: "MIDNIGHT CHASE", mood: "FLIRTY SLOW CHASE" },
  { id: "neon-pursuit", title: "NEON PURSUIT", mood: "TUNNEL-LIGHT RUSH" },
  { id: "night-cruise", title: "NIGHT CRUISE", mood: "LAID-BACK CRUISING" },
  { id: "nocturnal-run", title: "NOCTURNAL RUN", mood: "SLEEK AFTER DARK" },
  { id: "omotesando", title: "OMOTESANDO", mood: "CITY POP" },
  { id: "orange-horizon", title: "ORANGE HORIZON", mood: "STORM TO GLORY" },
  { id: "outrun-pulse", title: "OUTRUN PULSE", mood: "CLASSIC ARCADE DRIVE" },
  { id: "pick-up-or-crush-up", title: "PICK UP OR CRUSH UP", mood: "CHEEKY MAYHEM" },
  { id: "pickup-truck", title: "PICKUP TRUCK", mood: "HARD-WON TRIUMPH" },
  { id: "synthwave-engine", title: "SYNTHWAVE ENGINE", mood: "REVVING RETRO" },
  { id: "vector-world", title: "VECTOR WORLD", mood: "WIREFRAME COOL" },
];
export const MENU_TRACK = "boomers", RESULTS_TRACK = "wireline-cosmos";
