// The head unit (visual update, skin B "Night Shift"): one fascia, an upper list display, a lower LCD with the station
// index, the 13-slot band and the volume, and the Grand Prix control vocabulary. It picks the song (RADIO) or a record to
// shoot at (RECORDS), shows SCORES and HISTORY, and holds the WALLET and SYSTEM settings; posting a run happens on the
// results screen. The action key is DRIVE in RADIO and SHOT / COLLECT / CONNECT elsewhere. Geometry from game/data/menu.json (the kit's metadata.json, trimmed), one face per layout.
import { useEffect, useState } from "react";
import geometry from "./game/data/menu.json";
import { STATIONS } from "./game/stations";
import type { ChainApi, ChallengeNote } from "./chain/ChainHost";
import { blocksToClock as clock, fmtGc as gc, sameAccount as same, sameWord } from "./chain/flow";
import { boards, history, owed as owedNotes } from "./chain/hub";
import { noteDeadline } from "./chain/notes";

type Layout = "desktop" | "portrait" | "landscape";
export type Mode = "RADIO" | "RECORDS" | "SCORES" | "HISTORY" | "WALLET" | "SYSTEM" | "AUDIO";
const PRIMARY: Mode[] = ["RADIO", "RECORDS", "SCORES", "HISTORY", "WALLET", "SYSTEM"];
const ART = `${import.meta.env.BASE_URL}art/menu/`;
const px = (n: number) => `${n}px`;
// profile B
const DISPLAY = "#94e6dc", DIM = "#61928f", ACCENT = "#ff6a57", CREAM = "#fff3f4", YELLOW = "#ffe564", MINT = "#78ffcb", PINK = "#ff40bd", EXPIRED = "#8a9baa";

type Geometry = (typeof geometry)["desktop"];
type Control = Geometry["controls"][number];
/** One piece of a row: text at a fraction of the row's width (right aligned when `right`), mono for numbers and lists */
type Cell = { t: string; at: number; c?: string; right?: boolean; mono?: boolean };
type Row = { key: string; cells: Cell[] };

export function pickLayout(w: number, h: number): Layout {
  return h > w ? "portrait" : h < 460 ? "landscape" : "desktop";
}
const courseLabel = (seed: number) => `C${seed.toString(36).toUpperCase()}`;
const songOf = (i: number) => STATIONS[i]?.title ?? `SONG ${i}`;

/** Where a font's baseline sits under the top of a line-height-1 span, in em: half-leading plus ascent. */
const baselineEm = (() => {
  const cache = new Map<string, number>();
  return (font: string) => {
    let v = cache.get(font);
    if (v === undefined) {
      const c = document.createElement("canvas").getContext("2d")!;
      c.font = `100px "${font}"`;
      const m = c.measureText("HX0");
      v = (100 - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 200 + m.fontBoundingBoxAscent / 100;
      if (document.fonts.check(`100px "${font}"`)) cache.set(font, v);
    }
    return v;
  };
})();

export default function HeadUnit({ chain, station, setStation, volume, setVolume, muted, toggleMute, onDrive, onShot, onOff, openRecord, onOpened }: {
  chain: ChainApi | null;
  station: number; setStation: (i: number) => void;
  volume: number; setVolume: (v: number) => void; muted: boolean; toggleMute: () => void;
  onDrive: () => void;
  onShot: (shots: ChallengeNote[], record: ChallengeNote) => void;
  /** POWER: the unit off, back to the splash */
  onOff: () => void;
  /** a record opened by link: the head unit starts on its review */
  openRecord: ChallengeNote | null;
  onOpened: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => pickLayout(innerWidth, innerHeight));
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<Mode>("RADIO");
  const [back, setBack] = useState<Mode>("RADIO"); // where AUDIO returns to
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [review, setReview] = useState<ChallengeNote | null>(null);
  const [note, setNote] = useState<string | null>(null); // a line of our own in the display (copied link, gamecoins)
  const [pressed, setPressed] = useState<string | null>(null);
  const [, setTick] = useState(0);
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
  const lv = (label: string, value: string, c = YELLOW): Row => ({ key: label, cells: [{ t: label, at: 0 }, { t: value, at: 1, right: true, c, mono: true }] });
  const score5 = (n: number) => String(n).padStart(5, "0");

  // what the current mode lists, and what the action key does
  let rows: Row[] = [], status: string | null = null, action: string | null = null, onAction: (() => void) | null = null, onSelect: ((i: number) => void) | null = null, onArrow: ((d: number) => void) | null = null;
  const cur = cursor[mode] ?? 0;
  const notReady = !chain?.ready ? "LOADING THE CHAIN" : !chain.notesRead ? "READING THE CHAIN" : null;
  if (mode === "RADIO") {
    rows = STATIONS.map((st, i) => ({ key: st.id, cells: [{ t: String(i + 1).padStart(2, "0"), at: 0, c: DIM, mono: true }, { t: st.title, at: 0.05, c: i === station ? DISPLAY : CREAM, mono: true }] }));
    action = "DRIVE";
    onAction = onDrive; onSelect = (i) => setStation(i); onArrow = (d) => setStation((station + d + STATIONS.length) % STATIONS.length);
  } else if (mode === "RECORDS") {
    if (review) {
      const g = game(review), mine = same(me, review.storage.champion), over = review.consumed || height >= review.storage.expiryBlock - 140;
      rows = [lv("CHAMPION", champion(review), CREAM), lv("SCORE", score5(review.storage.target)), lv("PRIZE", gc(review.amount)), lv("STAKE", gc(review.storage.minStake)), lv("COURSE", courseLabel(g.seed), CREAM), lv("STATION", songOf(g.song), CREAM)];
      if (over) status = "THIS ONE IS OVER.";
      else if (mine) status = "THIS ONE IS YOURS.";
      else { action = "SHOT"; onAction = () => void chain?.shoot(review).then((r) => r && onShot(r.shots, r.record)); }
    } else {
      status = notReady ?? (open.length ? null : "NO OPEN RECORDS. DRIVE, THEN POST YOURS.");
      rows = open.map((n) => { const g = game(n); return { key: n.id, cells: [{ t: champion(n), at: 0 }, { t: score5(n.storage.target), at: 0.1, c: YELLOW, mono: true }, { t: gc(n.amount), at: 0.22, c: YELLOW, mono: true }, { t: courseLabel(g.seed), at: 0.34, mono: true }, { t: songOf(g.song), at: 0.5, mono: true }, { t: clock(n.storage.expiryBlock - height), at: 1, right: true, c: DISPLAY, mono: true }] }; });
      const sel = open[cur];
      if (sel) { action = "SHOT"; onAction = () => setReview(sel); onSelect = (i) => setReview(open[i]); }
    }
  } else if (mode === "HISTORY") {
    if (!me) status = chain?.connecting ? chain.walletStatus || "CONNECTING" : "CONNECT YOUR WALLET TO SEE YOUR GAMES.";
    else {
      // the finished games (hub.ts history): the result and, for a shot, whose record it was; the money that moved
      const past = history(notes, me, height, (a) => chain!.nameOf(a)).map((h) => ({ key: h.id, kind: h.kind, title: `${h.result}${h.kind === "shot" ? ` VS ${h.context.split("'")[0]}` : ""}`.toUpperCase(), score: h.score, state: h.money.toUpperCase(), color: h.tone === "mint" ? MINT : h.tone === "pink" ? PINK : EXPIRED }));
      const items: { key: string; kind: "record" | "shot"; title: string; score: number; state: string; color: string; shots?: ChallengeNote[]; record?: ChallengeNote }[] = [
        ...owed.map((n) => ({ key: n.id, kind: n.kind, title: n.kind === "record" ? "MY RECORD" : `${rival(n)} LOST`, score: n.storage.target, state: `COLLECT ${gc(n.amount)}`, color: MINT })),
        ...myRecords.map((n) => ({ key: n.id, kind: n.kind, title: "MY RECORD", score: n.storage.target, state: `OPEN ${clock(n.storage.expiryBlock - height)}`, color: DISPLAY })),
        ...myShots.map((n) => ({ key: n.id, kind: n.kind, title: `AT ${champion(n)}`, score: n.storage.target, state: `OPEN ${clock(noteDeadline(n) - height)}`, color: DISPLAY, shots: [n], record: notes.find((r) => r.kind === "record" && !r.consumed && sameWord(r.idWord, n.storage.recordId)) })),
        ...atMine.map((n) => ({ key: n.id, kind: n.kind, title: `${rival(n)} SHOOTING`, score: n.storage.target, state: "IN PLAY", color: DISPLAY })),
        ...past,
      ];
      status = items.length ? null : "NO GAMES YET. DRIVE, THEN POST YOUR SCORE.";
      rows = items.map((it) => ({ key: it.key, cells: [{ t: it.kind === "record" ? "R" : "S", at: 0, c: it.kind === "record" ? DISPLAY : PINK, mono: true }, { t: it.title, at: 0.04 }, { t: score5(it.score), at: 0.42, c: YELLOW, mono: true }, { t: it.state, at: 1, right: true, c: it.color, mono: true }] }));
      const sel = items[cur];
      if (owed.length) { action = "COLLECT"; onAction = () => void chain?.collect(owed); }
      else if (sel?.shots) { action = "SHOT"; onAction = () => onShot(sel.shots!, sel.record!); }
    }
  } else if (mode === "SCORES") {
    status = notReady ?? (best.top.length ? null : "NO RECORDS YET.");
    // one row per player: the board lists records, the first one met per champion is their best
    const seen = new Set<string>(), top = best.top.filter((r) => !seen.has(`${r.who.prefix}:${r.who.suffix}`) && seen.add(`${r.who.prefix}:${r.who.suffix}`));
    const list = best.mine && !seen.has(`${best.mine.who.prefix}:${best.mine.who.suffix}`) ? [...top, best.mine] : top;
    rows = list.map((r, i) => { const mine = same(me, r.who); return { key: r.key, cells: [{ t: String(i + 1).padStart(2, "0"), at: 0, c: DIM, mono: true }, { t: chain?.nameOf(r.who) ?? "???", at: 0.12, c: mine ? YELLOW : CREAM }, { t: score5(r.value), at: 1, right: true, c: YELLOW, mono: true }] }; });
  } else if (mode === "WALLET") {
    const name = me ? chain!.nameOf(me) : chain?.connecting ? chain.walletStatus || "CONNECTING" : "NOT CONNECTED";
    rows = [lv("WALLET", name, me ? MINT : chain?.connecting ? DISPLAY : PINK), lv("BALANCE", chain?.balance != null ? gc(chain.balance) : "--"), lv("NETWORK", "TESTNET", CREAM), lv("STATUS", busy ? busy.text : trouble ? "ERROR" : "IDLE", busy ? DISPLAY : trouble ? PINK : CREAM)];
    if (me) rows.push(lv("GAMECOINS", "GET 10", DISPLAY), lv("DISCONNECT", "SELECT", DISPLAY));
    if (!chain?.installed) status = "NO BREAD WALLET FOUND. INSTALL IT, THEN COME BACK.";
    if (!me) { action = "CONNECT"; onAction = () => void chain?.connect(); }
    else { action = "GET GC"; onAction = () => void chain?.gamecoins().then((m) => m && setNote(m)); onSelect = (i) => { if (i === 4) onAction!(); if (i === 5) void chain?.disconnect(); }; }
  } else if (mode === "AUDIO") {
    rows = [lv("VOLUME", `${Math.round(volume * 100)} %`), lv("MUTE", muted ? "ON" : "OFF", muted ? PINK : CREAM)];
    onArrow = (d) => { if (cur === 0) setVolume(Math.max(0, Math.min(1, volume + d * 0.1))); };
    onSelect = (i) => { if (i === 1) toggleMute(); };
  } else {
    rows = [lv("VERSION", __PUB_VERSION__, CREAM), lv("NETWORK", "MIDEN TESTNET", CREAM), lv("WALLET", chain?.local ? "TEST (?LOCAL=)" : "BREAD", CREAM), lv("LAYOUT", layout.toUpperCase(), CREAM), lv("KEYS", "1-6 ARROWS ENTER ESC", CREAM), lv("RESET BEST", `${Number(localStorage.getItem("pub.best") ?? 0)}  SELECT`, DISPLAY)];
    onSelect = (i) => { if (i === 5) { localStorage.removeItem("pub.best"); setNote("BEST SCORE CLEARED"); } };
  }
  if (busy) { action = null; onAction = null; onSelect = null; }
  if (trouble?.retry) { action = "TRY AGAIN"; onAction = () => { const r = trouble.retry!; chain?.dismiss(); r(); }; }
  const total = rows.length, at = mode === "RADIO" ? station : Math.min(cur, Math.max(0, total - 1)), rowsN = G.rows;
  const start = Math.min(Math.max(0, at - rowsN + 1), Math.max(0, total - rowsN));
  // up/down walk the list; left/right go to the mode's own arrow rule (tuning, the prize, the volume) or walk the list too
  const move = (d: number) => { if (mode === "RADIO") return onArrow?.(d); if (total) setCursor({ ...cursor, [mode]: (at + d + total) % total }); };
  const sideways = (d: number) => (onArrow ? onArrow(d) : move(d));

  const goMode = (m: Mode) => { if (PRIMARY.includes(m)) setBack(m); setMode(m); setReview(null); setNote(null); chain?.dismiss(); };
  const goBack = () => { if (trouble) return chain?.dismiss(); if (review) return setReview(null); if (mode === "AUDIO") return setMode(back); setNote(null); };
  const select = () => { if (busy) return; if (trouble) return onAction ? onAction() : chain?.dismiss(); if (onSelect) onSelect(at); else onAction?.(); };
  const press = (id: string, fn: () => void) => { setPressed(id); setTimeout(() => setPressed(null), 80); fn(); };
  const act = (c: Control, half?: 0 | 1) => {
    if (c.id.startsWith("preset-")) return goMode(PRIMARY[Number(c.id.slice(7)) - 1]);
    switch (c.id) {
      case "mode": return goMode(PRIMARY[(PRIMARY.indexOf(back) + 1) % PRIMARY.length]);
      case "band": { goMode("RADIO"); return setStation((station + 1 + Math.floor(Math.random() * (STATIONS.length - 1))) % STATIONS.length); } // seek: a random other station
      case "prev": return sideways(-1);
      case "next": return sideways(1);
      case "back": return goBack();
      case "select": return select();
      case "action": return !busy && onAction?.();
      case "vol": return setVolume(Math.max(0, Math.min(1, volume + (half === 0 ? -0.1 : 0.1))));
      case "audio": return goMode("AUDIO");
      case "system": return goMode("SYSTEM");
      case "mute": return toggleMute();
      case "power": return onOff();
    }
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "6") goMode(PRIMARY[Number(e.key) - 1]);
      else if (e.key === "ArrowUp") move(-1);
      else if (e.key === "ArrowDown") move(1);
      else if (e.key === "ArrowLeft") sideways(-1);
      else if (e.key === "ArrowRight") sideways(1);
      else if (e.key === "Enter") (mode === "RADIO" && !trouble ? onAction?.() : select());
      else if (e.key === "Escape" || e.key === "Backspace") goBack();
      else if (e.key === "m") toggleMute();
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  });

  // the face: the kit's states are rest, hover, pressed, disabled; "hover" also marks the lit key (the mode's preset)
  const lit = (c: Control) => (c.id.startsWith("preset-") ? PRIMARY[Number(c.id.slice(7)) - 1] === mode : c.id === "audio" ? mode === "AUDIO" : c.id === "system" ? mode === "SYSTEM" : c.id === "mute" ? muted : false);
  const disabled = (c: Control) => (c.id === "action" ? !action || !onAction || !!busy : c.id === "select" ? !!busy : false);
  const state = (c: Control) => (pressed === c.id ? "pressed" : disabled(c) ? "disabled" : lit(c) ? "hover" : "rest");
  const text = (t: string, x: number, baseline: number, size: number, color: string, mono = false, right = false, key?: string | number, width?: number) => (
    <span key={key} className={`hu-text ${mono ? "hu-mono" : "hu-gt"}`} style={{ [right ? "right" : "left"]: px(right ? G.size[0] - x : x), top: px(baseline - baselineEm(mono ? "Share Tech Mono" : "Chakra Petch") * size), fontSize: px(size), color, maxWidth: width ? px(width) : undefined }}>{t}</span>
  );
  const since = busy ? Math.round((Date.now() - busy.since) / 1000) : 0;
  const stageText = busy ? (busy.stage === "connect" ? chain?.walletStatus || "OPENING YOUR WALLET" : busy.stage === "prepare" ? "GETTING READY" : busy.stage === "wallet" ? "APPROVE IN YOUR WALLET" : `SENDING TO THE NETWORK  ${since} S`) : "";
  const statusLines = trouble ? [trouble.t.title.toUpperCase(), trouble.retry ? "ACTION KEY: TRY AGAIN.  BACK: OK." : "BACK: OK."] : busy ? [busy.text, stageText] : note ? [note] : status ? [status] : null;
  const windowRows = statusLines ? [] : rows.slice(start, start + rowsN);
  const [gx, gy, gw, gh] = G.glass, inner = [gx + 16, gw - 32] as const; // the rows' content box inside the glass
  const needleX = G.needle.range[0] + station * (G.needle.range[1] - G.needle.range[0]) / 12;
  const [lx, ly, lw, lh] = G.lcd, big = layout === "desktop" ? 28 : layout === "portrait" ? 22 : 18, small = layout === "landscape" ? 9 : 11;

  return (
    <div className="hu-screen" style={{ width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      <div className="hu-unit" style={{ left: px(G.origin[0]), top: px(G.origin[1]), width: px(G.size[0]), height: px(G.size[1]) }}>
        <img src={`${ART}${layout}/blank-face.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        <div className="hu-glass" style={{ left: px(G.glass[0]), top: px(G.glass[1]), width: px(G.glass[2]), height: px(G.glass[3]) }} onWheel={(e) => move(Math.sign(e.deltaY))} />
        {/* upper display */}
        {text(mode, G.title[0], G.title[1], G.title[2], DISPLAY, false, false, "title")}
        {mode === "RADIO" && text(`${String(station + 1).padStart(2, "0")} / ${STATIONS.length}`, gx + gw - 16, G.title[1], small, DIM, true, true, "count")}
        {(busy || trouble) && <i className="hu-dot" style={{ left: px(gx + gw - 30), top: px(gy + 12), borderColor: trouble ? ACCENT : DISPLAY }} />}
        {windowRows.map((row, j) => {
          const i = start + j, sel = G.selection[j], base = G.baselines[j];
          return (
            <div key={row.key} className="hu-row" style={{ left: px(sel[0]), top: px(sel[1]), width: px(sel[2]), height: px(sel[3]), borderColor: "transparent" }} onClick={() => (mode === "RADIO" ? setStation(i) : setCursor({ ...cursor, [mode]: i }), i === at && select())}>
              {i === at && <img src={`${ART}${layout}/selection-selected.png`} alt="" style={{ position: "absolute", left: 0, top: 0, width: px(sel[2]), height: px(sel[3]) }} />}
              {row.cells.map((c, k) => text(c.t, inner[0] + c.at * inner[1] - sel[0], base - sel[1], G.rowSize, c.c ?? CREAM, c.mono, c.right, k, inner[1] * (c.right ? 0.5 : 1 - c.at)))}
            </div>
          );
        })}
        {statusLines && (
          <div className="hu-status" style={{ left: px(gx + 24), top: px(gy + 40), width: px(gw - 48), height: px(gh - 56), fontSize: px(G.title[2] * 0.85), color: trouble ? ACCENT : DISPLAY }}>
            {statusLines.map((l, i) => <p key={i} style={i ? { color: DIM, fontSize: px(G.title[2] * 0.6) } : {}}>{l}</p>)}
          </div>
        )}
        {/* lower LCD: the radio keeps playing while you browse: the station index, the 13-slot band and the volume */}
        {text(String(station + 1).padStart(2, "0"), G.lcdBaseline[0], G.lcdBaseline[1], big, DISPLAY, true, false, "idx")}
        {STATIONS.map((_, i) => <i key={i} className="hu-tick" style={{ left: px(G.needle.range[0] + i * (G.needle.range[1] - G.needle.range[0]) / 12), top: px(G.needle.tipY + 6), height: px(layout === "landscape" ? 5 : 8), background: i === station ? DISPLAY : DIM }} />)}
        <i className="hu-needle" style={{ left: px(needleX - 4), top: px(G.needle.tipY - 2), borderTopColor: DISPLAY }} />
        {text(`VOL ${Math.round(volume * 100)}%${muted ? "  MUTE" : ""}`, lx + 16, ly + lh - 10, small, DIM, true, false, "vol")}
        {text(STATIONS[station].title, lx + lw - 16, ly + lh - 10, small, DIM, true, true, "song")}
        {/* controls */}
        {G.controls.map((c) => (
          <span key={c.id}>
            <img src={`${ART}${layout}/${c.id === "action" ? "action-blank" : c.id}-${state(c)}.png`} alt="" style={{ left: px(c.rect[0]), top: px(c.rect[1]), width: px(c.rect[2]), height: px(c.rect[3]) }} />
            {c.id === "vol" ? G.volumeHits.map((h, k) => <button key={k} className="hit" aria-label={k ? "Volume up" : "Volume down"} style={{ left: px(h[0]), top: px(h[1]), width: px(h[2]), height: px(h[3]) }} onClick={() => press(c.id, () => act(c, k as 0 | 1))} />)
              : <button className="hit" aria-label={c.id === "action" ? action ?? "" : c.label} disabled={disabled(c)} style={{ left: px(c.hit[0]), top: px(c.hit[1]), width: px(c.hit[2]), height: px(c.hit[3]) }} onClick={() => press(c.id, () => act(c))} />}
          </span>
        ))}
        {/* the action key's label, drawn once on the kit's baseline: DRIVE, SHOT, POST, COLLECT... */}
        {action && <span className="hu-text hu-gt hu-label" style={{ left: px(G.label.baseline[0] - G.label.maxWidth / 2), top: px(G.label.baseline[1] - baselineEm("Chakra Petch") * G.label.size + (pressed === "action" ? 2 : 0)), width: px(G.label.maxWidth), fontSize: px(G.label.size), color: disabled(G.controls.find((c) => c.id === "action")!) ? G.label.disabledFill : G.label.fill }}>{action}</span>}
      </div>
    </div>
  );
}
