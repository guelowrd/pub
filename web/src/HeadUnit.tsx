// The head unit (designer's menu kit): the Testarossa's Grand Prix radio face with a second DIN display above it. Six
// modes on the presets (RADIO, RECORDS, POST, HISTORY, SCORES, WALLET) plus AUDIO and SYSTEM; the upper display lists,
// the lower segment window shows the selection and the AUTO key's action. Layers and geometry come from
// game/data/headunit.json (the kit's metadata.json, trimmed), one face per layout.
import { useEffect, useState } from "react";
import geometry from "./game/data/headunit.json";
import { STATIONS } from "./game/stations";
import type { ChainApi, ChallengeNote, Posted } from "./chain/ChainHost";
import type { Event } from "./game/sim";
import { PRIZES } from "./chain/config";
import { blocksToClock as clock, fmtGc as gc, recordLinks, sameAccount as same, sameWord } from "./chain/flow";
import { boards, history, owed as owedNotes } from "./chain/hub";
import { noteDeadline } from "./chain/notes";

type Layout = "desktop" | "portrait" | "landscape";
export type Mode = "RADIO" | "RECORDS" | "POST" | "HISTORY" | "SCORES" | "WALLET" | "AUDIO" | "SYSTEM";
const PRIMARY: Mode[] = ["RADIO", "RECORDS", "POST", "HISTORY", "SCORES", "WALLET"];
const ART = `${import.meta.env.BASE_URL}art/headunit/`;
const px = (n: number) => `${n}px`;
const CYAN = "#63e7ff", PINK = "#ff40bd", YELLOW = "#ffe564", MINT = "#78ffcb", CREAM = "#fff3f4", GREY = "#8fadb7", DIM = "#8bb6bb", EXPIRED = "#8a9baa";

type Rect = number[];
type Spec = { clip: Rect; baseline: Rect; size: number; align?: string; font?: string };
type Geometry = (typeof geometry)["desktop"];
type Control = Geometry["controls"][number];
export type LastRun = { seed: number; song: number; score: number; log: Event[]; dist: number };
type Row = { cells: { spec: Spec; text: string; color?: string; font?: "GT" | "LCD" }[]; key: string; mine?: boolean };

export function pickLayout(w: number, h: number): Layout {
  return h > w ? "portrait" : h < 460 ? "landscape" : "desktop";
}
const courseLabel = (seed: number) => `C${seed.toString(36).toUpperCase()}`;
const songOf = (i: number) => STATIONS[i]?.title ?? `SONG ${i}`;

export default function HeadUnit({ chain, station, setStation, volume, setVolume, muted, toggleMute, lastRun, initialMode = "RADIO", onDrive, onShot, openRecord, onOpened }: {
  chain: ChainApi | null;
  initialMode?: Mode;
  station: number; setStation: (i: number) => void;
  volume: number; setVolume: (v: number) => void; muted: boolean; toggleMute: () => void;
  lastRun: LastRun | null;
  onDrive: () => void;
  onShot: (shots: ChallengeNote[], record: ChallengeNote) => void;
  /** a record opened by link: the head unit starts on its review */
  openRecord: ChallengeNote | null;
  onOpened: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => pickLayout(innerWidth, innerHeight));
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [back, setBack] = useState<Mode>(initialMode); // where AUDIO / SYSTEM return to
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [review, setReview] = useState<ChallengeNote | null>(null);
  const [band, setBand] = useState(false);
  const [prize, setPrize] = useState(0);
  const [posted, setPosted] = useState<Posted | null>(null);
  const [note, setNote] = useState<string | null>(null); // a line of our own in the status area (copied link, gamecoins)
  const [pressed, setPressed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const G = geometry[layout] as Geometry;

  useEffect(() => {
    const fit = () => {
      const lay = pickLayout(innerWidth, innerHeight), g = geometry[lay];
      setLayout(lay);
      setScale(Math.min(innerWidth / g.canvas[0], innerHeight / g.canvas[1]));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []); // the waiting counter and the clocks
  useEffect(() => setPosted(null), [lastRun]);
  useEffect(() => {
    if (!openRecord) return;
    setMode("RECORDS"); setReview(openRecord); onOpened();
  }, [openRecord, onOpened]);

  const me = chain?.me ?? null;
  const height = chain?.height ?? 0;
  const notes = chain?.notes ?? [];
  const busy = chain?.busy ?? null;
  const trouble = chain?.trouble ?? null;

  // the lists behind the modes
  const open = notes.filter((n) => n.kind === "record" && !n.consumed && n.amount > 0n && height < n.storage.expiryBlock - 140 && !same(me, n.storage.champion)).sort((a, b) => a.storage.target - b.storage.target);
  const owed = owedNotes(notes, height, me);
  const myRecords = me ? notes.filter((n) => n.kind === "record" && !n.consumed && same(me, n.storage.champion) && !owed.includes(n)) : [];
  const myShots = me ? notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.rival) && height < noteDeadline(n)) : [];
  const atMine = me ? notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.champion) && !same(me, n.storage.rival) && !owed.includes(n)) : [];
  const best = boards(notes, height, me).records;
  const champion = (n: ChallengeNote) => chain?.nameOf(n.storage.champion) ?? "???";
  const rival = (n: ChallengeNote) => (n.storage.rival && chain?.nameOf(n.storage.rival)) ?? "???";
  const game = (n: ChallengeNote) => ({ seed: Number(n.storage.game[0] ?? 0n), song: Number(n.storage.game[4] ?? 0n) });

  const R = G.rows, R0 = R[0], rowsN = G.visibleRows;
  const F = (spec: Spec, text: string, color = CREAM, font?: "GT" | "LCD") => ({ spec, text, color, font });
  const lv = (label: string, value: string, vc = YELLOW): Row => ({ key: label, cells: [F(R0.label_value_fields.label, label, GREY, "GT"), F(R0.label_value_fields.value, value, vc, "LCD")] });

  // what the current mode lists, and what AUTO does
  let rows: Row[] = [], status: string | null = null, action: string | null = null, detail = "", secondary = "", onAuto: (() => void) | null = null, onSelect: ((i: number) => void) | null = null, onArrow: ((d: number) => void) | null = null;
  const cur = cursor[mode] ?? 0;
  const notReady = !chain?.ready ? "LOADING THE CHAIN" : !chain.notesRead ? "READING THE CHAIN" : null;
  if (mode === "RADIO") {
    rows = STATIONS.map((st, i) => ({ key: st.id, cells: [F({ clip: [R0.clip[0], R0.clip[1], 100, R0.clip[3]], baseline: [R0.clip[0] + 12, R0.baseline[1]], size: R0.size }, String(i + 1).padStart(2, "0"), YELLOW, "LCD"), F({ clip: [R0.clip[0] + (layout === "desktop" ? 110 : 60), R0.clip[1], R0.clip[2] - 120, R0.clip[3]], baseline: [R0.clip[0] + (layout === "desktop" ? 120 : 65), R0.baseline[1]], size: R0.size }, st.title, i === station ? MINT : CREAM, "GT")] }));
    detail = STATIONS[station].title; secondary = muted ? "SOUND OFF" : STATIONS[station].mood; action = "DRIVE";
    onAuto = onDrive; onSelect = (i) => setStation(i); onArrow = (d) => setStation((station + d + STATIONS.length) % STATIONS.length);
  } else if (mode === "RECORDS") {
    if (review) {
      const g = game(review), mine = same(me, review.storage.champion), over = review.consumed || height >= review.storage.expiryBlock - 140;
      rows = [lv("CHAMPION", champion(review), CREAM), lv("SCORE", String(review.storage.target)), lv("PRIZE", gc(review.amount)), lv("STAKE", gc(review.storage.minStake)), lv("COURSE", courseLabel(g.seed), CREAM), lv("STATION", songOf(g.song), CREAM)].slice(0, rowsN === 4 ? 6 : 6);
      detail = String(review.storage.target); secondary = `${courseLabel(g.seed)} / ${songOf(g.song)}`;
      if (over) status = "THIS ONE IS OVER.";
      else if (mine) status = "THIS ONE IS YOURS.";
      else { action = "SHOT"; onAuto = () => void chain?.shoot(review).then((r) => r && onShot(r.shots, r.record)); }
    } else {
      status = notReady ?? (open.length ? null : "NO OPEN RECORDS. DRIVE, THEN POST YOURS.");
      rows = open.map((n) => { const g = game(n), r = R0.record_fields; return { key: n.id, cells: [F(r.champion, champion(n), CREAM, "GT"), F(r.score, String(n.storage.target), YELLOW, "LCD"), F(r.prize, gc(n.amount).replace(" GC", ""), YELLOW, "LCD"), F(r.course, courseLabel(g.seed), CREAM, "GT"), F(r.station, songOf(g.song), CREAM, "GT"), F(r.time_left, clock(n.storage.expiryBlock - height), CYAN, "LCD")] }; });
      const sel = open[cur];
      if (sel) { const g = game(sel); detail = String(sel.storage.target); secondary = `${courseLabel(g.seed)} / ${songOf(g.song)}`; action = "SHOT"; onAuto = () => setReview(sel); onSelect = (i) => setReview(open[i]); }
    }
  } else if (mode === "POST") {
    if (!lastRun) status = "DRIVE FIRST. YOUR SCORE COMES HERE.";
    else if (posted) {
      rows = [lv("POSTED", String(posted.score)), lv("PRIZE", gc(PRIZES[prize])), lv("SHARE ON X", "SELECT", CYAN), lv("COPY LINK", "SELECT", CYAN)];
      detail = String(posted.score); secondary = "RECORD POSTED";
      const { url, x } = recordLinks(posted.recordId, posted.score, posted.expiresAt, songOf(posted.song));
      onSelect = (i) => {
        if (i === 2) window.open(x, "_blank", "noopener");
        if (i === 3) void navigator.clipboard?.writeText(url).then(() => setNote("LINK COPIED"), () => setNote(url));
      };
    } else {
      rows = [lv("SCORE", String(lastRun.score)), lv("PRIZE", gc(PRIZES[prize])), lv("COURSE", courseLabel(lastRun.seed), CREAM), lv("STATION", songOf(lastRun.song), CREAM)];
      detail = String(lastRun.score); secondary = `PRIZE ${gc(PRIZES[prize])}`; action = "POST";
      onAuto = () => void chain?.post(lastRun.seed, lastRun.song, lastRun.score, PRIZES[prize]).then((p) => p && setPosted(p));
      onArrow = (d) => { if (cur === 1) setPrize((prize + d + PRIZES.length) % PRIZES.length); };
    }
  } else if (mode === "HISTORY") {
    if (!me) status = chain?.connecting ? chain.walletStatus || "CONNECTING" : "CONNECT YOUR WALLET TO SEE YOUR GAMES.";
    else {
      // the finished games (hub.ts history): the result and, for a shot, whose record it was; the money that moved
      const past = history(notes, me, height, (a) => chain!.nameOf(a)).map((h) => ({ key: h.id, kind: h.kind, title: `${h.result}${h.kind === "shot" ? ` VS ${h.context.split("'")[0]}` : ""}`.toUpperCase(), score: h.score, state: h.money.toUpperCase(), color: h.tone === "mint" ? MINT : h.tone === "pink" ? PINK : EXPIRED }));
      const items: { key: string; kind: "record" | "shot"; title: string; score: number; state: string; color: string; shots?: ChallengeNote[]; record?: ChallengeNote }[] = [
        ...owed.map((n) => ({ key: n.id, kind: n.kind, title: n.kind === "record" ? "MY RECORD" : `${rival(n)} LOST`, score: n.storage.target, state: `COLLECT ${gc(n.amount)}`, color: MINT })),
        ...myRecords.map((n) => ({ key: n.id, kind: n.kind, title: "MY RECORD", score: n.storage.target, state: `OPEN ${clock(n.storage.expiryBlock - height)}`, color: CYAN })),
        ...myShots.map((n) => ({ key: n.id, kind: n.kind, title: `AT ${champion(n)}`, score: n.storage.target, state: `OPEN ${clock(noteDeadline(n) - height)}`, color: CYAN, shots: [n], record: notes.find((r) => r.kind === "record" && !r.consumed && sameWord(r.idWord, n.storage.recordId)) })),
        ...atMine.map((n) => ({ key: n.id, kind: n.kind, title: `${rival(n)} SHOOTING`, score: n.storage.target, state: "IN PLAY", color: CYAN })),
        ...past,
      ];
      status = items.length ? null : "NO GAMES YET. DRIVE, THEN POST YOUR SCORE.";
      rows = items.map((it) => { const h = R0.history_fields; return { key: it.key, cells: [F({ clip: h.kind_icon.rect!, baseline: [h.kind_icon.rect![0], h.kind_icon.rect![1] + h.kind_icon.rect![3]], size: h.kind_icon.rect![3] }, it.kind === "record" ? "■" : "○", it.kind === "record" ? CYAN : PINK, "GT"), F(h.title, it.title, CREAM, "GT"), F(h.score, String(it.score), YELLOW, "LCD"), F(h.state, it.state, it.color, "GT")] }; });
      const sel = items[cur];
      if (sel) { detail = String(sel.score); secondary = sel.title; }
      if (owed.length) { action = "COLLECT"; onAuto = () => void chain?.collect(owed); }
      else if (sel?.shots) { action = "SHOT"; onAuto = () => onShot(sel.shots!, sel.record!); }
    }
  } else if (mode === "SCORES") {
    status = notReady ?? (best.top.length ? null : "NO RECORDS YET.");
    const list = best.mine ? [...best.top, best.mine] : best.top;
    rows = list.map((r) => { const s = R0.score_fields, mine = same(me, r.who); return { key: r.key, mine, cells: [F(s.rank, String(r.rank).padStart(2, "0"), CYAN, "LCD"), F(s.nickname, chain?.nameOf(r.who) ?? "???", mine ? YELLOW : CREAM, "GT"), F(s.score, String(r.value), YELLOW, "LCD")] }; });
    const sel = list[cur], note_ = sel && notes.find((n) => n.id === sel.key);
    if (sel) { detail = String(sel.value); secondary = `${chain?.nameOf(sel.who) ?? "???"}${note_ ? ` / ${songOf(game(note_).song)}` : ""}`; }
  } else if (mode === "WALLET") {
    const name = me ? chain!.nameOf(me) : chain?.connecting ? chain.walletStatus || "CONNECTING" : "NOT CONNECTED";
    rows = [lv("WALLET", name, me ? MINT : chain?.connecting ? CYAN : PINK), lv("BALANCE", chain?.balance != null ? gc(chain.balance) : "--"), lv("NETWORK", "TESTNET", CREAM), lv("STATUS", busy ? busy.text : trouble ? "ERROR" : "IDLE", busy ? CYAN : trouble ? PINK : CREAM)];
    if (me) rows.push(lv("GAMECOINS", "GET 10", CYAN), lv("DISCONNECT", "SELECT", CYAN));
    if (!chain?.installed) status = "NO BREAD WALLET FOUND. INSTALL IT, THEN COME BACK.";
    detail = chain?.balance != null ? gc(chain.balance) : ""; secondary = me ? chain!.local ? "TEST WALLET" : "BREAD" : "";
    if (!me) { action = "CONNECT"; onAuto = () => void chain?.connect(); }
    else { action = "GET GC"; onAuto = () => void chain?.gamecoins().then((m) => m && setNote(m)); onSelect = (i) => { if (i === 4) onAuto!(); if (i === 5) void chain?.disconnect(); }; }
  } else if (mode === "AUDIO") {
    rows = [lv("VOLUME", `${Math.round(volume * 100)} %`), lv("MUTE", muted ? "ON" : "OFF", muted ? PINK : CREAM)];
    detail = `VOL ${Math.round(volume * 100)}`; secondary = muted ? "SOUND OFF" : "";
    onArrow = (d) => { if (cur === 0) setVolume(Math.max(0, Math.min(1, volume + d * 0.1))); };
    onSelect = (i) => { if (i === 1) toggleMute(); };
  } else {
    rows = [lv("VERSION", __PUB_VERSION__, CREAM), lv("NETWORK", "MIDEN TESTNET", CREAM), lv("WALLET", chain?.local ? "TEST (?LOCAL=)" : "BREAD", CREAM), lv("LAYOUT", layout.toUpperCase(), CREAM), lv("KEYS", "1-6 ARROWS ENTER ESC", CREAM)];
    detail = "PUB"; secondary = __PUB_VERSION__;
  }
  if (busy) { action = null; onAuto = null; onSelect = null; }
  if (trouble?.retry) { action = "TRY AGAIN"; onAuto = () => { const r = trouble.retry!; chain?.dismiss(); r(); }; }
  const total = rows.length, at = Math.min(cur, Math.max(0, total - 1));
  const start = Math.min(Math.max(0, at - rowsN + 1), Math.max(0, total - rowsN));
  const move = (d: number) => { if (onArrow && (mode === "RADIO" || mode === "AUDIO" || mode === "POST")) return onArrow(d); if (total) setCursor({ ...cursor, [mode]: (at + d + total) % total }); };
  const arrowKeys = (d: number) => { if (onArrow && mode !== "RADIO") return onArrow(d); if (mode === "RADIO") return onArrow?.(d); };

  const goMode = (m: Mode) => { if (PRIMARY.includes(m)) setBack(m); setMode(m); setReview(null); setBand(false); setNote(null); chain?.dismiss(); };
  const goBack = () => { if (trouble) return chain?.dismiss(); if (review) return setReview(null); if (mode === "AUDIO" || mode === "SYSTEM") return setMode(back); if (band) return setBand(false); setNote(null); };
  const select = () => { if (busy) return; if (trouble) return onAuto ? onAuto() : chain?.dismiss(); if (onSelect) onSelect(at); else onAuto?.(); };
  const press = (id: string, fn: () => void) => { setPressed(id); setTimeout(() => setPressed(null), 80); fn(); };
  const act = (c: Control, half?: "decrease" | "increase") => {
    if (c.mode) return goMode(c.mode as Mode);
    switch (c.action) {
      case "mode": return goMode(PRIMARY[(PRIMARY.indexOf(back) + 1) % PRIMARY.length]);
      case "frequency-view": return mode === "RADIO" && setBand(!band);
      case "previous": return mode === "RADIO" ? onArrow?.(-1) : move(-1);
      case "next": return mode === "RADIO" ? onArrow?.(1) : move(1);
      case "back": return goBack();
      case "select": return select();
      case "primary": return !busy && onAuto?.();
      case "volume": return setVolume(Math.max(0, Math.min(1, volume + (half === "decrease" ? -0.1 : 0.1))));
      case "audio": return goMode("AUDIO");
      case "system": return goMode("SYSTEM");
      case "mute": return toggleMute();
      case "power": return goMode("RADIO");
    }
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "6") goMode(PRIMARY[Number(e.key) - 1]);
      else if (e.key === "ArrowUp") move(-1);
      else if (e.key === "ArrowDown") move(1);
      else if (e.key === "ArrowLeft") (mode === "RADIO" || onArrow ? arrowKeys(-1) : move(-1));
      else if (e.key === "ArrowRight") (mode === "RADIO" || onArrow ? arrowKeys(1) : move(1));
      else if (e.key === "Enter") (mode === "RADIO" && !trouble ? onAuto?.() : select());
      else if (e.key === "Escape" || e.key === "Backspace") goBack();
      else if (e.key === "m") toggleMute();
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  });

  // the face
  const lit = (c: Control) => (c.mode ? c.mode === mode : c.id === "audio" ? mode === "AUDIO" : c.id === "system" ? mode === "SYSTEM" : c.id === "mute" ? muted : c.id === "freq-band" ? band : c.id === "auto" ? !!action && !!onAuto && !busy : false);
  const disabled = (c: Control) => (c.id === "auto" ? !action || !onAuto || !!busy : c.id === "select" ? !!busy : c.id === "freq-band" ? mode !== "RADIO" : false);
  const state = (c: Control) => (pressed === c.id ? "pressed" : disabled(c) ? "disabled" : lit(c) ? "lit" : "rest");
  const field = (spec: Spec, text: string, color: string, font: "GT" | "LCD", key?: string | number) => (
    <div key={key} className="hu-field" style={{ left: px(spec.clip[0]), top: px(spec.clip[1]), width: px(spec.clip[2]), height: px(spec.clip[3]) }}>
      {/* line-height 1 puts the baseline 0.86 em under the span's top (both fonts: ascent 0.96, descent 0.24 em) */}
      <span className={font === "LCD" ? "lcd" : "gt"} style={{ [spec.align === "right" ? "right" : "left"]: px(spec.align === "right" ? Math.max(0, spec.clip[0] + spec.clip[2] - spec.baseline[0]) : spec.baseline[0] - spec.clip[0]), top: px(spec.baseline[1] - spec.clip[1] - 0.86 * spec.size), fontSize: px(spec.size), color }}>{text}</span>
    </div>
  );
  const since = busy ? Math.round((Date.now() - busy.since) / 1000) : 0;
  const stageText = busy ? (busy.stage === "connect" ? chain?.walletStatus || "OPENING YOUR WALLET" : busy.stage === "prepare" ? "GETTING READY" : busy.stage === "wallet" ? "APPROVE IN YOUR WALLET" : `SENDING TO THE NETWORK  ${since} S`) : "";
  void tick;
  const statusLines = trouble ? [trouble.t.title.toUpperCase(), trouble.retry ? "AUTO: TRY AGAIN.  BACK: OK." : "BACK: OK."] : busy ? [busy.text, stageText] : note ? [note] : status ? [status] : null;
  const indicator = busy ? CYAN : trouble ? PINK : null;
  const bandOn = mode === "RADIO" && band;
  const needleX = G.band.needleX[0] + station * (G.band.needleX[1] - G.band.needleX[0]) / 13;
  const windowRows = statusLines || bandOn ? [] : rows.slice(start, start + rowsN);

  return (
    <div className="hu-screen" style={{ width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      <div className="hu-unit" style={{ left: px(G.origin[0]), top: px(G.origin[1]), width: px(G.size[0]), height: px(G.size[1]) }}>
        {G.layers.map((l) => <img key={l.id} src={`${ART}${layout}/${l.id}.png`} alt="" style={{ left: px(l.rect[0]), top: px(l.rect[1]), width: px(l.rect[2]), height: px(l.rect[3]) }} />)}
        {/* upper display */}
        {field(G.title, mode, CYAN, "GT", "title")}
        {indicator && <i className="hu-dot" style={{ left: px(G.indicator.center[0] - 7), top: px(G.indicator.center[1] - 7), borderColor: indicator }} />}
        {bandOn && <>
          <img src={`${ART}${layout}/frequency-band.png`} alt="" style={{ left: px(G.band.rect[0]), top: px(G.band.rect[1]), width: px(G.band.rect[2]), height: px(G.band.rect[3]) }} />
          <img src={`${ART}${layout}/frequency-needle.png`} alt="" style={{ left: px(needleX - 4), top: px(G.band.needleY), transition: "left .25s" }} />
        </>}
        {windowRows.map((row, j) => {
          const i = start + j, r = R[j];
          const rel = (spec: Spec): Spec => ({ ...spec, clip: [spec.clip[0] - R0.clip[0], spec.clip[1] - R0.clip[1], spec.clip[2], spec.clip[3]], baseline: [spec.baseline[0] - R0.clip[0], spec.baseline[1] - R0.clip[1]] });
          return (
            <div key={row.key} className="hu-row" style={{ left: px(r.clip[0]), top: px(r.clip[1]), width: px(r.clip[2]), height: px(r.clip[3]) }} onClick={() => R0.hit && (setCursor({ ...cursor, [mode]: i }), i === at && select())}>
              {i === at && <img src={`${ART}${layout}/${mode === "POST" && cur === 1 && !posted ? "editing-row" : "selected-row"}.png`} alt="" style={{ left: 0, top: 0, width: px(r.clip[2]), height: px(r.clip[3]) }} />}
              {row.cells.map((c, k) => field(rel(c.spec), c.text, c.color ?? CREAM, c.font ?? "GT", k))}
            </div>
          );
        })}
        {statusLines && (
          <div className="hu-status" style={{ left: px(G.status.clip[0]), top: px(G.status.clip[1]), width: px(G.status.clip[2]), height: px(G.status.clip[3]), fontSize: px(G.status.size), color: trouble ? PINK : CYAN }}>
            {statusLines.map((l, i) => <p key={i} style={i ? { color: DIM, fontSize: px(G.status.size * 0.75) } : {}}>{l}</p>)}
          </div>
        )}
        {/* lower segment window */}
        {field(G.detail, detail, MINT, "LCD", "detail")}
        {field(G.secondary, secondary, DIM, "LCD", "secondary")}
        {field(G.action, action ?? "", YELLOW, "LCD", "action")}
        {/* controls */}
        {G.controls.map((c) => (
          <span key={c.id}>
            <img src={`${ART}${layout}/${c.id}-${state(c)}.png`} alt="" style={{ left: px(c.rect[0]), top: px(c.rect[1]), width: px(c.rect[2]), height: px(c.rect[3]) }} />
            {c.sub ? Object.entries(c.sub).map(([half, h]) => <button key={half} className="hit" aria-label={`Volume ${half}`} style={{ left: px(h[0]), top: px(h[1]), width: px(h[2]), height: px(h[3]) }} onClick={() => press(c.id, () => act(c, half as "decrease" | "increase"))} />)
              : <button className="hit" aria-label={c.mode ?? c.action} disabled={disabled(c)} style={{ left: px(c.hit[0]), top: px(c.hit[1]), width: px(c.hit[2]), height: px(c.hit[3]) }} onClick={() => press(c.id, () => act(c))} />}
          </span>
        ))}
      </div>
    </div>
  );
}
