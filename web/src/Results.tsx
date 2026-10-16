// The results screen (results kit, Night Shift): the score and the stats over the frozen, dimmed scene; the riders still
// on board; the post well (POST IT, then SHARE ON X / COPY LINK / SAVE CARD) or the shot's verdict; SAME RUN / NEW RUN.
// Geometry from game/data/results.json (the kit's metadata, trimmed), one frame per layout.
import { useState } from "react";
import { baselineEm, px, useFit } from "./board";
import geometry from "./game/data/results.json";
import { CHARACTERS } from "./game/course";
import { RATE, agePoints, type Rider, type Sim } from "./game/sim";
import { STATIONS } from "./game/stations";
import { STAKE } from "./chain/config";
import { recordLinks } from "./chain/flow";
import { saveCard } from "./share";
import type { ChainApi, Posted } from "./chain/ChainHost";
import type { Settled } from "./chain/useChain";

const ART = `${import.meta.env.BASE_URL}art/`;
const PORTRAITS: Record<string, string> = { a: "portraits.webp", b: "portraits-b.webp", c: "portraits-c.webp" };
const CYAN = "#94e6dc", YELLOW = "#ffe16f", MINT = "#91efbc", PINK = "#fa79a6", MUTED = "#91a8aa", LIGHT = "#e6eae1";
const TERMS = "RIVALS PAY TO TRY TO BEAT YOU. IF THEY DO, THEY TAKE YOUR GAMECOIN. OTHERWISE THEIRS IS YOURS.";
const pad5 = (n: number) => String(n).padStart(5, "0");
const fmt = (n: number) => n.toLocaleString("en-US");
type Geometry = (typeof geometry)["desktop"];
type Kind = "post" | "share" | "footer";
type KeyDef = { kind: Kind; rect: number[]; label: string; disabled?: boolean; onClick?: () => void };

/** A kit key: the blank plate in its state, the label on the kit's baseline. */
function Key({ kind, rect: [x, y, w, h], label, disabled, onClick, layout }: KeyDef & { layout: string }) {
  const [hover, setHover] = useState(false), [down, setDown] = useState(false);
  const drive = kind === "post", size = drive ? Math.min(27, 0.22 * w) : Math.min(21, 0.37 * h, 0.22 * w), base = h * (drive ? 0.64 : 0.63) + (drive && down ? 2 : 0);
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
  const { layout, scale } = useFit(geometry);
  const G = geometry[layout] as Geometry;
  const [note, setNote] = useState<string | null>(null);
  const text = (t: string, x: number, baseline: number, size: number, color: string, mono = false, align: "left" | "right" | "center" = "left", width?: number, key?: string | number) => (
    <span key={key} className={`hu-text ${mono ? "hu-mono" : "hu-gt"}`} style={{ left: px(align === "right" ? x - (width ?? 600) : align === "center" ? x - (width ?? 600) / 2 : x), width: px(width ?? 600), textAlign: align, top: px(baseline - baselineEm(mono ? "Share Tech Mono" : "Chakra Petch") * size), fontSize: px(size), color }}>{t}</span>
  );
  const face = (r: Rider, [x, y]: number[], key: number) => {
    const ch = CHARACTERS[r.id];
    return <i key={key} className="face" style={{ position: "absolute", left: px(x), top: px(y), width: px(G.aboard.face[0]), height: px(G.aboard.face[1]), border: 0, backgroundImage: `url(${ART}${PORTRAITS[ch.atlasSet ?? "a"]})`, backgroundPosition: `${(ch.atlasIndex % 4) * 100 / 3}% ${Math.floor(ch.atlasIndex / 4) * 100 / 3}%` }} />;
  };
  const best = Math.max(Number(localStorage.getItem("pub.best") ?? 0), s.score);
  const lostPts = s.lost.reduce((a, r) => a + agePoints(r.age), 0);
  const busy = chain?.busy ?? null, trouble = chain?.trouble ?? null;

  // the post well: what it says, which key it offers; or the shot's verdict
  let heading = "POST YOUR RECORD", color = CYAN, status: string | null = TERMS, keys: KeyDef[] = [], footer: KeyDef[];
  if (shot) {
    const left = (label: string, onClick?: () => void) => ({ kind: "footer" as const, rect: G.footer[0], label, disabled: !onClick, onClick });
    footer = [settled?.again ? left("TRY AGAIN", onAgain) : settled?.won ? left("NEW RUN", onNew) : trouble?.retry ? left("TRY AGAIN", () => onRetry(trouble.retry!)) : left("TRY AGAIN"),
      { kind: "footer", rect: G.footer[1], label: "MENU", disabled: !!busy, onClick: onMenu }];
    if (settled) { heading = settled.won ? "RECORD BEATEN" : "RECORD HELD"; color = settled.won ? MINT : PINK; status = settled.text; }
    else { heading = "CHECKING RESULT"; status = trouble ? trouble.t.title.toUpperCase() : busy ? busy.text : `SCORE TO BEAT ${pad5(shot.target)}`; }
  } else {
    footer = [{ kind: "footer", rect: G.footer[0], label: "SAME RUN", onClick: onSame }, { kind: "footer", rect: G.footer[1], label: "NEW RUN", onClick: onNew }];
    const post = () => { chain?.dismiss(); void chain?.post(s.seed, station, s.score).then((p) => p && setPosted(p)); };
    const postKey = (label: string, disabled = false, onClick = post): KeyDef => ({ kind: "post", rect: G.action, label, disabled, onClick });
    if (posted) {
      heading = "RECORD POSTED"; color = MINT; status = note;
      const links = recordLinks(posted.recordId, posted.score, posted.expiresAt, STATIONS[posted.song].title);
      // three share keys in the kit's two-key row: SHARE ON X, COPY LINK and the card to save
      const [a, b] = G.share, gap = b[0] - a[0] - a[2], w = (b[0] + b[2] - a[0] - 2 * gap) / 3;
      const riders = s.stops.filter((o) => o.taken && o.rider).map((o) => o.rider!).sort((p, q) => agePoints(q.age) - agePoints(p.age));
      keys = [["SHARE ON X", () => window.open(links.x, "_blank", "noopener")], ["COPY LINK", () => void navigator.clipboard?.writeText(links.url).then(() => setNote("LINK COPIED"), () => setNote("COPY FAILED"))], ["SAVE CARD", () => void saveCard(posted.score, STATIONS[posted.song].title, riders).catch(() => setNote("COULD NOT SAVE"))]]
        .map(([label, onClick], i) => ({ kind: "share" as const, rect: [a[0] + i * (w + gap), a[1], w, a[3]], label: label as string, onClick: onClick as () => void }));
    } else if (trouble) { status = trouble.t.title.toUpperCase(); keys = [postKey("TRY AGAIN", false, () => { const r = trouble.retry; chain?.dismiss(); r ? r() : post(); })]; }
    else if (busy) { status = busy.stage === "connect" ? "CONNECTING" : busy.stage === "wallet" ? "CHECK WALLET" : busy.stage === "prepare" ? "GETTING READY" : "POSTING"; keys = [postKey(busy.stage === "network" ? "POSTING" : "POST IT", true)]; }
    else if (!chain?.ready) { status = "LOADING THE CHAIN"; keys = [postKey("POST IT", true)]; }
    else if (!chain.me) { status = "CONNECT WALLET"; keys = [postKey("CONNECT", false, () => void chain.connect())]; }
    else if (chain.balance != null && chain.balance < STAKE) { status = "NEED GC"; keys = [postKey("GET GC", false, () => void chain.gamecoins().then((m) => m && setNote(m)))]; }
    else { status = note ?? TERMS; keys = [postKey("POST IT")]; }
  }

  const stats: [string, string][] = [["RIDERS DELIVERED", String(s.delivered)], ["DELIVERY POINTS", fmt(s.banked)], ["DISTANCE", `${fmt(Math.floor(s.dist * RATE))} m`]];
  const { labels, labelSize, labelAlign, split, values, valueSize, valueAlign } = G.stats as Geometry["stats"] & { labelAlign: "left" | "center"; valueAlign: "right" | "center" };
  return (
    <div className="hu-screen" style={{ width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      <div className="hu-unit" style={{ left: px(G.origin[0]), top: px(G.origin[1]), width: px(G.size[0]), height: px(G.size[1]) }}>
        <img src={`${ART}results/${layout}/frame.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        <img src={`${ART}results/${layout}/wells.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        {text("TIME IS UP", G.title[0], G.title[1], G.title[2], CYAN)}
        {text(pad5(s.score), G.score[0], G.score[1], G.score[2], YELLOW, true, "left", G.score[3])}
        {text(`BEST ${pad5(best)}`, G.best[0] as number, G.best[1] as number, G.best[2] as number, MUTED, true, G.best[3] as "left" | "right")}
        {stats.map(([label, value], i) => {
          const [lx, ly] = labels[i], [vx, vy] = values[i], words = split ? label.split(" ") : [label];
          return [
            ...words.map((wd, j) => text(wd, lx, ly + j * 14, labelSize, CYAN, false, labelAlign, undefined, `l${i}${j}`)),
            text(value, vx, vy, valueSize, YELLOW, true, valueAlign, undefined, `v${i}`),
          ];
        })}
        {text("STILL ON BOARD", G.aboard.head[0], G.aboard.head[1], G.aboard.head[2], PINK)}
        {text(s.lost.length ? `${fmt(lostPts)} LOST` : "NO RIDERS LEFT", G.aboard.total[0], G.aboard.total[1], G.aboard.total[2], s.lost.length ? PINK : MUTED, true, "right")}
        {s.lost.slice(0, 3).map((r, i) => [
          face(r, G.aboard.faces[i], i),
          text(`AGE ${r.age}`, G.aboard.ages[i][0], G.aboard.ages[i][1], G.aboard.ageSize, LIGHT, false, "left", undefined, `a${i}`),
          text(String(agePoints(r.age)), G.aboard.pts[i][0], G.aboard.pts[i][1], G.aboard.ptsSize, PINK, true, G.aboard.ptsAlign as "left" | "right", undefined, `p${i}`),
        ])}
        {text(heading, G.post.head[0], G.post.head[1], G.post.head[2], color)}
        {status && <span className="hu-text hu-mono rs-status" style={{ left: px(G.post.status[0]), width: px(G.post.status[3]), top: px(G.post.status[1] - baselineEm("Share Tech Mono") * G.post.status[2]), fontSize: px(G.post.status[2]), color: MUTED }}>{status}</span>}
        {[...keys, ...footer].map((k) => <Key key={k.label} {...k} layout={layout} />)}
      </div>
    </div>
  );
}
