# The thirteen tracks for the link preview: id -> (title, stage art). Mirrors src/game/stations.ts (district-time[-rain]).
TRACKS = {
    "nocturnal-run": ("NOCTURNAL RUN", "golf-night"),
    "synthwave-engine": ("SYNTHWAVE ENGINE", "downtown-sunset"),
    "abandoned-factory": ("ABANDONED FACTORY", "downtown-night-rain"),
    "midnight-chase": ("MIDNIGHT CHASE", "downtown-night"),
    "outrun-pulse": ("OUTRUN PULSE", "waterfront-midday"),
    "vector-world": ("VECTOR WORLD", "casino-sunset"),
    "pickup-truck": ("PICKUP TRUCK", "golf-midday"),
    "dark-horse": ("DARK HORSE", "golf-night-rain"),
    "bittersweet-sunset": ("BITTERSWEET SUNSET", "waterfront-sunset"),
    "neon-pursuit": ("NEON PURSUIT", "casino-night-rain"),
    "orange-horizon": ("ORANGE HORIZON", "golf-sunset"),
    "night-cruise": ("NIGHT CRUISE", "waterfront-night"),
    "pick-up-or-crush-up": ("PICK UP OR CRUSH UP", "casino-midday"),
}
DEFAULT = "midnight-chase"

def track(t):
    """The track's (id, title, stage) for a link's `t`, Midnight Chase when it is missing or unknown."""
    t = t if t in TRACKS else DEFAULT
    return (t, *TRACKS[t])

def score(s):
    """The link's score as an int, None when missing or not a plausible score."""
    try:
        n = int(s)
    except (TypeError, ValueError):
        return None
    return n if 0 <= n <= 999_999 else None
