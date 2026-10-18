// The results screen (results kit, Night Shift): the score and the stats over the frozen, dimmed scene; the riders still
// on board; the post well (POST IT, then SHARE ON X / COPY LINK / SAVE CARD) or the shot's verdict; SAME RUN / NEW RUN.
// Geometry from game/data/results.json (the kit's metadata, trimmed), one frame per layout.
import { useEffect, useState } from "react";
import { baselineEm, fmt, px, stored, useFit } from "./board";
import geometry from "./game/data/results.json";
import { ART, PORTRAITS } from "./game/art";
import { CHARACTERS } from "./game/course";
import { RATE, agePoints, type Rider, type Sim } from "./game/sim";
import { STATIONS } from "./game/stations";
import { STAKE } from "./chain/config";
import { recordLinks, waiting } from "./chain/flow";
import { saveCard } from "./share";
import type { ChainApi, Posted } from "./chain/ChainHost";
import type { Settled } from "./chain/useChain";

const CYAN = "#94e6dc", YELLOW = "#ffe16f", MINT = "#91efbc", PINK = "#fa79a6", MUTED = "#91a8aa", LIGHT = "#e6eae1";
const TERMS = "RIVALS GOTTA PAY TO CHALLENGE YOUR SCORE.\nIF THEY BEAT IT, THEY TAKE YOUR GAMECOIN.\nBUT IF THEY DON'T, THEIR GAMECOIN IS YOURS!";
type Geometry = (typeof geometry)["desktop"];
type Kind = "post" | "share" | "footer";
type KeyDef = { kind: Kind; rect: number[]; label: string; disabled?: boolean; onClick?: () => void };

/** A kit key: the blank plate in its state, the label on the kit's baseline. */
function Key({ kind, rect: [x, y, w, h], label, disabled, onClick, layout }: KeyDef & { layout: string }) {
  const [hover, setHover] = useState(false), [down, setDown] = useState(false);
  // the size fits the key's width as well as its height: three share keys in a portrait row cut SHARE ON X to SHARE O (Gaylord's phone, 2026-10-17)
  const drive = kind === "post", size = Math.min(drive ? 27 : Math.min(21, 0.37 * h), 0.22 * w, (w - 16) / (label.length * 0.62)), base = drive ? h / 2 + size * 0.35 + (down ? 2 : 0) : h * 0.63;
  const state = disabled ? "disabled" : down ? "pressed" : hover ? "hover" : "rest";
  return (
    <button className="hit rk" disabled={disabled} aria-label={label} style={{ left: px(x), top: px(y), width: px(w), height: px(h) }} onClick={onClick}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => { setHover(false); setDown(false); }} onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)}>
      <img src={`${ART}results/${layout}/${kind}-blank-${state}.png`} alt="" />
      <span className="hu-text hu-gt" style={{ left: px(8), width: px(w - 16), top: px(base - baselineEm("Chakra Petch") * size), fontSize: px(size), color: disabled ? (drive ? "#6f7b79" : "#657274") : drive ? "#fff3df" : "#e8eae1", textAlign: "center" }}>{label}</span>
    </button>
  );
}

export default function Results({ s, station, chain, posted, setPosted, shot, settled, onSame, onNew, onAgain, onMenu, onRetry }: {
  s: Sim; station: number; chain: ChainApi | null;
  posted: Posted | null; setPosted: (p: Posted) => void;
  /** the record shot at, if this run was a shot */
  shot: { target: number } | null; settled: Settled | null;
  onSame: () => void; onNew: () => void; onAgain: () => void; onMenu: () => void; onRetry: (retry: () => void) => void;
}) {
  const { layout, scale, left, top } = useFit(geometry);
  const G = geometry[layout] as Geometry;
  const [note, setNote] = useState<string | null>(null);
  const busy = chain?.busy ?? null, trouble = chain?.trouble ?? null;
  const [, setTick] = useState(0);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, [busy]); // the waiting line's clock
  const text = (t: string, x: number, baseline: number, size: number, color: string, mono = false, align: "left" | "right" | "center" = "left", width?: number, key?: string | number) => (
    <span key={key} className={`hu-text ${mono ? "hu-mono" : "hu-gt"}`} style={{ left: px(align === "right" ? x - (width ?? 600) : align === "center" ? x - (width ?? 600) / 2 : x), width: px(width ?? 600), textAlign: align, top: px(baseline - baselineEm(mono ? "Share Tech Mono" : "Chakra Petch") * size), fontSize: px(size), color }}>{t}</span>
  );
  const face = (r: Rider, [x, y]: number[], key: number) => {
    const ch = CHARACTERS[r.id];
    return <i key={key} className="face" style={{ position: "absolute", left: px(x), top: px(y), width: px(G.riders.face), height: px(G.riders.face), border: 0, backgroundImage: `url(${ART}${PORTRAITS[ch.atlasSet ?? "a"]})`, backgroundPosition: `${(ch.atlasIndex % 4) * 100 / 3}% ${Math.floor(ch.atlasIndex / 4) * 100 / 3}%` }} />;
  };
  const best = Math.max(Number(stored("pub.best") ?? 0), s.score);
  // every passenger picked up, in order; the ones still aboard at time-up, or gone in a wreck, are a note (and pink)
  const picked = s.stops.filter((o) => o.taken && o.rider).map((o) => o.rider!);
  const R = G.riders, shown = picked.slice(0, R.cols * R.rows);

  // the post well: what it says, which key it offers; or the shot's verdict
  let heading = "POST YOUR RECORD", color = CYAN, status: string | null = TERMS, keys: KeyDef[] = [], footer: KeyDef[];
  if (shot) {
    const left = (label: string, onClick?: () => void) => ({ kind: "footer" as const, rect: G.footer[0], label, disabled: !onClick, onClick });
    footer = [settled?.again ? left("TRY AGAIN", onAgain) : settled?.won ? left("NEW RUN", onNew) : trouble?.retry ? left("TRY AGAIN", () => onRetry(trouble.retry!)) : left("TRY AGAIN"),
      { kind: "footer", rect: G.footer[1], label: "MENU", disabled: !!busy, onClick: onMenu }];
    if (settled) { heading = settled.won ? "RECORD BEATEN" : "RECORD HELD"; color = settled.won ? MINT : PINK; status = settled.text; }
    else { // the score tells the verdict before the chain does; the wait says where it is and how long it takes
      const won = s.score > shot.target;
      heading = won ? "RECORD BEATEN" : "CHECKING RESULT"; if (won) color = MINT;
      status = trouble ? trouble.t.title.toUpperCase() : busy ? [busy.text, ...waiting(busy, chain?.local)].join("\n") : `SCORE TO BEAT ${fmt(shot.target)}`;
    }
  } else {
    footer = [{ kind: "footer", rect: G.footer[0], label: "SAME RUN", onClick: onSame }, { kind: "footer", rect: G.footer[1], label: "NEW RUN", onClick: onNew }];
    const post = () => { chain?.dismiss(); void chain?.post(s.seed, station, s.score).then((p) => { if (p) { setPosted(p); setNote(null); } }); };
    const postKey = (label: string, disabled = false, onClick = post): KeyDef => ({ kind: "post", rect: G.action, label, disabled, onClick });
    const grant = () => void chain?.gamecoins().then((m) => m && setNote(m));
    // no Gamecoins (the post's own check, or a balance read before): the faucet key in place of POST IT, the record stays on
    // screen until the coins are in (Gaylord's phone, 2026-10-17; 2026-10-18: no POST IT while the wallet is known empty)
    const needCoins = () => { heading = "NEED GAMECOINS"; color = YELLOW; status = "A POST COSTS 1 GAMECOIN. GET 10 FREE,\nOPEN YOUR WALLET TO TAKE THEM, THEN POST."; keys = [postKey("GET GAMECOINS", false, grant)]; };
    if (posted) {
      heading = "RECORD POSTED"; color = MINT; status = note;
      const links = recordLinks(posted.recordId, posted.score, posted.expiresAt, STATIONS[posted.song].title);
      // three share keys in the kit's two-key row: SHARE ON X, COPY LINK and the card to save
      const [a, b] = G.share, gap = b[0] - a[0] - a[2], w = (b[0] + b[2] - a[0] - 2 * gap) / 3;
      const riders = s.stops.filter((o) => o.taken && o.rider).map((o) => o.rider!).sort((p, q) => agePoints(q.age) - agePoints(p.age));
      keys = [["SHARE ON X", () => window.open(links.x, "_blank", "noopener")], ["COPY LINK", () => void navigator.clipboard?.writeText(links.url).then(() => setNote("LINK COPIED"), () => setNote("COPY FAILED"))], ["SAVE CARD", () => void saveCard(posted.score, STATIONS[posted.song].title, riders).catch(() => setNote("COULD NOT SAVE"))]]
        .map(([label, onClick], i) => ({ kind: "share" as const, rect: [a[0] + i * (w + gap), a[1], w, a[3]], label: label as string, onClick: onClick as () => void }));
    } else if (trouble?.t.kind === "funds") needCoins();
    else if (trouble) { status = trouble.t.title.toUpperCase(); keys = [postKey("TRY AGAIN", false, () => { const r = trouble.retry; chain?.dismiss(); r ? r() : post(); })]; }
    else if (busy) { // the key says what is being sent (a post, or the faucet's Gamecoins), the status the step before it
      const coins = /GAMECOINS/.test(busy.text);
      if (coins) heading = "NEED GAMECOINS";
      status = waiting(busy, chain?.local).join("\n");
      keys = [postKey(busy.stage !== "network" ? "POST IT" : coins ? "GETTING GAMECOINS" : "POSTING", true)];
    }
    else if (!chain?.ready) { status = "LOADING THE CHAIN"; keys = [postKey("POST IT", true)]; }
    else if (!chain.me) { status = null; keys = [postKey("CONNECT", false, () => void chain.connect())]; } // the key says it
    else if (chain.balance != null && chain.balance < STAKE) needCoins();
    else { status = note ?? TERMS; keys = [postKey("POST IT")]; }
  }

  // the status lines shrink to fit the well's width and the room above the key (the terms are three lines); on desktop the
  // action key sits beside them, as tall as the well
  const lines = status ? status.split("\n") : [], [, sb, size0, sw, room] = G.post.status;
  const statusSize = Math.max(7, Math.min(size0, sw / (Math.max(1, ...lines.map((l) => l.length)) * 0.54), room / (Math.max(1, lines.length) * 1.25)));
  const statusTop = sb - baselineEm("Share Tech Mono") * statusSize;
  const well = (G.post as { well?: number[] }).well; // desktop and landscape: the key stands beside the terms and fills the well
  if (well) for (const k of keys) if (k.kind === "post") k.rect = [k.rect[0], well[0] + (layout === "desktop" ? 12 : 0), k.rect[2], well[1] - (layout === "desktop" ? 24 : 0)];
  const stats: [string, string][] = [["PASSENGERS DELIVERED", String(s.delivered)], ["DELIVERY POINTS", fmt(s.banked)], ["DISTANCE POINTS", fmt(Math.floor(s.dist * RATE))]];
  const { labels, labelSize, labelAlign, split, values, valueSize, valueAlign } = G.stats as Geometry["stats"] & { labelAlign: "left" | "center"; valueAlign: "right" | "center" };
  return (
    <div className="hu-screen" style={{ left: px(left), top: px(top), width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      <div className="hu-unit" style={{ left: px(G.origin[0]), top: px(G.origin[1]), width: px(G.size[0]), height: px(G.size[1]) }}>
        <img src={`${ART}results/${layout}/frame.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        <img src={`${ART}results/${layout}/wells.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        {text("TIME IS UP! YOU SCORED", G.title[0], G.title[1], G.title[2], CYAN)}
        <span className="hu-text hu-mono" style={{ left: px(G.score[0]), width: px(G.score[3]), top: px(G.score[1] - baselineEm("Share Tech Mono") * G.score[2]), fontSize: px(G.score[2]), color: YELLOW }}>{fmt(s.score)}<span className="hu-gt" style={{ fontSize: px(labelSize), marginLeft: px(labelSize * 0.6) }}>POINTS</span></span>
        {text(`YOUR BEST: ${fmt(best)}`, G.best[0] as number, G.best[1] as number, G.best[2] as number, MUTED, true, G.best[3] as "left" | "right")}
        {stats.map(([label, value], i) => {
          const [lx, ly] = labels[i], [vx, vy] = values[i], words = split ? label.split(" ") : [label];
          return [
            ...words.map((wd, j) => text(wd, lx, ly + j * 14, labelSize, CYAN, false, labelAlign, undefined, `l${i}${j}`)),
            text(value, vx, vy, valueSize, YELLOW, true, valueAlign, undefined, `v${i}`),
          ];
        })}
        {text(picked.length > shown.length ? `PASSENGERS (${shown.length} OF ${picked.length})` : "PASSENGERS", R.head[0], R.head[1], R.head[2], CYAN)}
        {shown.map((r, i) => {
          const x = R.origin[0] + (i % R.cols) * R.pitch[0], y = R.origin[1] + Math.floor(i / R.cols) * R.pitch[1], gone = s.lost.includes(r) ? "ON BOARD" : s.bailed.includes(r) ? "BAILED" : null;
          return [
            face(r, [x, y], i),
            text(`AGE ${r.age}`, x + R.age[0], y + R.age[1], R.age[2], LIGHT, false, "left", R.pitch[0] - R.age[0], `a${i}`),
            // a passenger still aboard, or who bailed in a wreck, never scored: the points are crossed out
            <span key={`p${i}`} className="hu-text hu-mono" style={{ left: px(x + R.pts[0]), top: px(y + R.pts[1] - baselineEm("Share Tech Mono") * R.pts[2]), fontSize: px(R.pts[2]), color: gone ? PINK : YELLOW }}>{gone ? <><s>{fmt(agePoints(r.age))}</s> {gone}</> : fmt(agePoints(r.age))}</span>,
          ];
        })}
        {text(heading, G.post.head[0], G.post.head[1], G.post.head[2], color)}
        {status && <span className="hu-text hu-mono rs-status" style={{ left: px(G.post.status[0]), width: px(G.post.status[3]), top: px(statusTop), fontSize: px(statusSize), color: MUTED }}>{status}</span>}
        {[...keys, ...footer].map((k) => <Key key={k.label} {...k} layout={layout} />)}
      </div>
    </div>
  );
}
