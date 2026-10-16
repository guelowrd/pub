// The head unit (Stage TV pack): a colour car TV above the Grand Prix radio. The TV shows the stage before you drive (the
// song is the stage: its painting, its district, light and weather) and lists the other modes; the radio's lower LCD
// holds the station index, the 13-slot band and the volume. RADIO picks the song, RECORDS a record to shoot at, SCORES
// and HISTORY show the boards, WALLET and SYSTEM hold the settings; posting a run happens on the results screen. The
// action key is DRIVE in RADIO and SHOT / COLLECT / CONNECT elsewhere. Geometry from game/data/menu.json (the pack's
// component-contracts.json, trimmed, plus the TV's list and caption geometry), one fascia per layout.
import { useEffect, useRef, useState } from "react";
import { baselineEm, px, useFit } from "./board";
import geometry from "./game/data/menu.json";
import { DISTRICT_NAME, STATIONS, type Station } from "./game/stations";
import type { ChainApi, ChallengeNote } from "./chain/ChainHost";
import { blocksToClock as clock, fmtGc as gc, sameAccount as same, sameWord } from "./chain/flow";
import { boards, history, owed as owedNotes } from "./chain/hub";
import { noteDeadline } from "./chain/notes";

export type Mode = "RADIO" | "RECORDS" | "SCORES" | "HISTORY" | "WALLET" | "SYSTEM" | "AUDIO";
const PRIMARY: Mode[] = ["RADIO", "RECORDS", "SCORES", "HISTORY", "WALLET", "SYSTEM"];
const ART = `${import.meta.env.BASE_URL}art/`;
// the pack's palette
const DISPLAY = "#94e6dc", DIM = "#61928f", ACCENT = "#ff6a57", CREAM = "#fff3f4", YELLOW = "#ffe564", MINT = "#78ffcb", PINK = "#ff40bd", EXPIRED = "#8a9baa";
const TAG = "#aff7e8", COUNT = "#effae5", TITLE = "#fff2d9", PLACE = "#b2e8e2", LIGHT = "#eec7e8", WEATHER = "#f1d896", LCD = "#98e7dc", LCD_DIM = "#71b7b2", TICK = "#58938f";

type Geometry = (typeof geometry)["desktop"];
type Control = Geometry["controls"][number];
/** One piece of a row in the TV list's columns (the pack's RECORDS board): the number, the name, the score (right aligned),
 * the state word, or a value against the right edge; an icon sits in the icon slot */
type Cell = { t: string; col: "num" | "name" | "score" | "state" | "value"; c?: string; icon?: string };
type Row = { key: string; cells: Cell[] };

const courseLabel = (seed: number) => `C${seed.toString(36).toUpperCase()}`;
const songOf = (i: number) => STATIONS[i]?.title ?? `SONG ${i}`;
// the TV's painting of a stage: the district at its hour, rain or not (PUB-Stage-Previews-Checked 2)
const previewOf = (st: Station) => `${ART}stage/${st.district}-${st.time}${st.rain ? "-rain" : ""}.png`;
// history (results kit): the kind's icon, the state word in its colour
const ICON = `${ART}icons/`;
const STATE: Record<string, string> = { OPEN: "#70d4e7", "IN PLAY": "#f5bd62", COLLECT: "#91efbc", BEATEN: "#fa79a6", DEFENDED: "#f1d36f", "TAKEN BACK": "#a0acb5", WON: "#91efbc", LOST: "#fa79a6" };
const stateColor = (state: string) => STATE[Object.keys(STATE).find((k) => state.startsWith(k)) ?? ""] ?? EXPIRED;

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
  const { layout, scale } = useFit(geometry);
  const [mode, setMode] = useState<Mode>("RADIO");
  const [back, setBack] = useState<Mode>("RADIO"); // where AUDIO returns to
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [review, setReview] = useState<ChallengeNote | null>(null);
  const [note, setNote] = useState<string | null>(null); // a line of our own in the display (copied link, gamecoins)
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState(false); // the action key has a hover face
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set()); // the paintings the TV can show
  const [, setTick] = useState(0);
  const wheel = useRef(0); // scroll distance pooled until a step
  const G = geometry[layout] as Geometry, TV = G.tv;
  const act0 = G.controls.find((c) => c.id === "action")!;

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []); // the waiting counter and the clocks
  useEffect(() => {
    if (!openRecord) return;
    setMode("RECORDS"); setReview(openRecord); onOpened();
  }, [openRecord, onOpened]);
  useEffect(() => { // every stage's painting warms up at once; TUNING shows until the current one is in
    for (const st of STATIONS) { const src = previewOf(st), img = new Image(); img.onload = () => setLoaded((s) => new Set(s).add(src)); img.src = src; }
  }, []);

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
  const lv = (label: string, value: string, c = YELLOW): Row => ({ key: label, cells: [{ t: label, col: "name" }, { t: value, col: "value", c }] });
  const score5 = (n: number) => n.toLocaleString("en-US");

  // what the current mode lists, and what the action key does
  let rows: Row[] = [], status: string | null = null, action: string | null = null, onAction: (() => void) | null = null, onSelect: ((i: number) => void) | null = null, onArrow: ((d: number) => void) | null = null;
  const cur = cursor[mode] ?? 0;
  const notReady = !chain?.ready ? "LOADING THE CHAIN" : !chain.notesRead ? "READING THE CHAIN" : null;
  if (mode === "RADIO") {
    action = "DRIVE";
    onAction = onDrive; onSelect = (i) => setStation(i); onArrow = (d) => setStation((station + d + STATIONS.length) % STATIONS.length);
  } else if (mode === "RECORDS") {
    if (review) {
      const g = game(review), mine = same(me, review.storage.champion), over = review.consumed || height >= review.storage.expiryBlock - 140;
      rows = [lv("CHAMPION", champion(review), CREAM), lv("SCORE", score5(review.storage.target)), lv("PRIZE", gc(review.amount)), lv("STAKE", gc(review.storage.minStake)), lv("COURSE", courseLabel(g.seed), CREAM), lv("STAGE", songOf(g.song), CREAM), lv("TIME LEFT", clock(review.storage.expiryBlock - height), DISPLAY)];
      if (over) status = "THIS ONE IS OVER.";
      else if (mine) status = "THIS ONE IS YOURS.";
      else { action = "SHOT"; onAction = () => void chain?.shoot(review).then((r) => r && onShot(r.shots, r.record)); }
    } else {
      status = notReady ?? (open.length ? null : "NO OPEN RECORDS. DRIVE, THEN POST YOURS.");
      rows = open.map((n, i) => ({ key: n.id, cells: [{ t: String(i + 1), col: "num", c: DIM }, { t: champion(n), col: "name" }, { t: score5(n.storage.target), col: "score", c: YELLOW }, { t: songOf(game(n).song), col: "state", c: DISPLAY }, { t: "", col: "state", icon: "record" }] }));
      const sel = open[cur];
      if (sel) { action = "SHOT"; onAction = () => setReview(sel); onSelect = (i) => setReview(open[i]); }
    }
  } else if (mode === "HISTORY") {
    if (!me) status = chain?.connecting ? chain.walletStatus || "CONNECTING" : "CONNECT YOUR WALLET TO SEE YOUR GAMES.";
    else {
      // the finished games (hub.ts history): the result and, for a shot, whose record it was; the money that moved
      // state words: OPEN and IN PLAY carry their clock; a finished game says what became of it (BEATEN, DEFENDED, TAKEN BACK, WON, LOST)
      const past = history(notes, me, height, (a) => chain!.nameOf(a)).map((h) => ({ key: h.id, kind: h.kind, title: h.kind === "shot" ? `AT ${h.context.split("'")[0]}` : "MY RECORD", score: h.score, state: h.result.replace(/^You /, "").toUpperCase() }));
      const items: { key: string; kind: "record" | "shot"; title: string; score: number; state: string; shots?: ChallengeNote[]; record?: ChallengeNote }[] = [
        ...owed.map((n) => ({ key: n.id, kind: n.kind, title: n.kind === "record" ? "MY RECORD" : `${rival(n)} LOST`, score: n.storage.target, state: `COLLECT ${gc(n.amount)}` })),
        ...myRecords.map((n) => ({ key: n.id, kind: n.kind, title: "MY RECORD", score: n.storage.target, state: `OPEN ${clock(n.storage.expiryBlock - height)}` })),
        ...myShots.map((n) => ({ key: n.id, kind: n.kind, title: `AT ${champion(n)}`, score: n.storage.target, state: `OPEN ${clock(noteDeadline(n) - height)}`, shots: [n], record: notes.find((r) => r.kind === "record" && !r.consumed && sameWord(r.idWord, n.storage.recordId)) })),
        ...atMine.map((n) => ({ key: n.id, kind: n.kind, title: `${rival(n)} SHOOTING`, score: n.storage.target, state: "IN PLAY" })),
        ...past,
      ];
      status = items.length ? null : "NO GAMES YET. DRIVE, THEN POST YOUR SCORE.";
      rows = items.map((it) => ({ key: it.key, cells: [{ t: it.title, col: "name" }, { t: score5(it.score), col: "score", c: YELLOW }, { t: it.state, col: "state", c: stateColor(it.state) }, { t: "", col: "state", icon: it.kind }] }));
      const sel = items[cur];
      if (owed.length) { action = "COLLECT"; onAction = () => void chain?.collect(owed); }
      else if (sel?.shots) { action = "SHOT"; onAction = () => onShot(sel.shots!, sel.record!); }
    }
  } else if (mode === "SCORES") {
    status = notReady ?? (best.top.length ? null : "NO RECORDS YET.");
    // one row per player: the board lists records, the first one met per champion is their best
    const seen = new Set<string>(), top = best.top.filter((r) => !seen.has(`${r.who.prefix}:${r.who.suffix}`) && seen.add(`${r.who.prefix}:${r.who.suffix}`));
    const list = best.mine && !seen.has(`${best.mine.who.prefix}:${best.mine.who.suffix}`) ? [...top, best.mine] : top;
    rows = list.map((r, i) => { const mine = same(me, r.who); return { key: r.key, cells: [{ t: String(i + 1), col: "num", c: DIM }, { t: chain?.nameOf(r.who) ?? "???", col: "name", c: mine ? YELLOW : CREAM }, { t: score5(r.value), col: "score", c: YELLOW }] }; });
  } else if (mode === "WALLET") {
    const name = me ? chain!.nameOf(me) : chain?.connecting ? chain.walletStatus || "CONNECTING" : "NOT CONNECTED";
    rows = [lv("WALLET", name, me ? MINT : chain?.connecting ? DISPLAY : PINK), lv("BALANCE", chain?.balance != null ? gc(chain.balance) : me ? "SELECT TO READ" : "--", chain?.balance != null ? YELLOW : DISPLAY), lv("NETWORK", "TESTNET", CREAM), lv("STATUS", busy ? busy.text : trouble ? "ERROR" : "IDLE", busy ? DISPLAY : trouble ? PINK : CREAM)];
    if (me) rows.push(lv("GAMECOINS", "GET 10", DISPLAY), lv("DISCONNECT", "SELECT", DISPLAY));
    if (!chain?.installed) status = "NO BREAD WALLET FOUND. INSTALL IT, THEN COME BACK.";
    if (!me) { action = "CONNECT"; onAction = () => void chain?.connect(); }
    else { action = "GET GC"; onAction = () => void chain?.gamecoins().then((m) => m && setNote(m)); onSelect = (i) => { if (i === 1) void chain?.readBalance(); if (i === 4) onAction!(); if (i === 5) void chain?.disconnect(); }; }
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
  const total = rows.length, at = mode === "RADIO" ? station : Math.min(cur, Math.max(0, total - 1)), rowsN = TV.list.baselines.length;
  const start = Math.min(Math.max(0, at - rowsN + 1), Math.max(0, total - rowsN));
  // up/down walk the list; left/right go to the mode's own arrow rule (tuning, the volume) or walk the list too
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

  // the faces: rest, pressed, lit (the mode's preset, AUDIO, SYSTEM, MUTE on), disabled; the action key alone has a hover face
  const lit = (c: Control) => (c.id.startsWith("preset-") ? PRIMARY[Number(c.id.slice(7)) - 1] === mode : c.id === "audio" ? mode === "AUDIO" : c.id === "system" ? mode === "SYSTEM" : c.id === "mute" ? muted : false);
  const disabled = (c: Control) => (c.id === "action" ? !action || !onAction || !!busy : c.id === "select" ? !!busy : false);
  const state = (c: Control) => (pressed === c.id ? "pressed" : disabled(c) ? "disabled" : lit(c) ? "lit" : c.id === "action" && hover ? "hover" : "rest");
  /** Text on its baseline inside a box `W` wide (the radio by default, the TV for its captions) */
  const text = (t: string, x: number, baseline: number, size: number, color: string, mono = false, right = false, key?: string | number, width?: number, W = G.size[0]) => (
    <span key={key} className={`hu-text ${mono ? "hu-mono" : "hu-gt"}`} style={{ [right ? "right" : "left"]: px(right ? W - x : x), top: px(baseline - baselineEm(mono ? "Share Tech Mono" : "Chakra Petch") * size), fontSize: px(size), color, maxWidth: width ? px(width) : undefined }}>{t}</span>
  );
  const since = busy ? Math.round((Date.now() - busy.since) / 1000) : 0;
  const stageText = busy ? (busy.stage === "connect" ? chain?.walletStatus || "OPENING YOUR WALLET" : busy.stage === "prepare" ? "GETTING READY" : busy.stage === "wallet" ? "APPROVE IN YOUR WALLET" : `SENDING TO THE NETWORK  ${since} S`) : "";
  const stage = STATIONS[station], preview = previewOf(stage), tuning = mode === "RADIO" && !loaded.has(preview);
  const statusLines = trouble ? [trouble.t.title.toUpperCase(), trouble.retry ? "ACTION KEY: TRY AGAIN.  BACK: OK." : "BACK: OK."] : busy ? [busy.text, stageText] : note ? [note] : status ? [status] : tuning ? ["TUNING"] : null;
  const windowRows = statusLines ? [] : rows.slice(start, start + rowsN);
  const [sx, sy, sw, sh] = TV.screen, L = TV.list, [cx, , cw] = L.clip;
  const needleX = G.needle.range[0] + station * (G.needle.range[1] - G.needle.range[0]) / 12;
  const [lx, , lw] = G.lcd;
  const conditions: [string, string, string][] = [["location", DISTRICT_NAME[stage.district], PLACE], [stage.time, stage.time.toUpperCase(), LIGHT], [stage.rain ? "rain" : "clear", stage.rain ? "RAIN" : "CLEAR", WEATHER]];
  const labelTop = G.label.centre[1] + G.label.size * 0.35 - baselineEm("Chakra Petch") * G.label.size + (pressed === "action" ? 2 : 0);

  return (
    <div className="hu-screen" style={{ width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      {/* the TV: the painting in the tube, the bezel and glass over it, the captions on top of the glass */}
      <div className="tv" style={{ left: px(TV.origin[0]), top: px(TV.origin[1]), width: px(TV.size[0]), height: px(TV.size[1]) }} onWheel={(e) => { wheel.current += e.deltaY; if (Math.abs(wheel.current) >= 80) { move(Math.sign(wheel.current)); wheel.current = 0; } }}>
        <div className="tv-screen" style={{ left: px(sx), top: px(sy), width: px(sw), height: px(sh), borderRadius: px(TV.radius) }}>
          {mode === "RADIO" && !tuning && <img className="tv-pic" src={preview} alt="" />}
          {mode === "RADIO" && !tuning && <div className="tv-caption" />}
        </div>
        {mode !== "RADIO" && <img src={`${ART}tv/${layout}/display.png`} alt="" style={{ left: 0, top: 0, width: px(TV.size[0]), height: px(TV.size[1]) }} />}
        <img src={`${ART}tv/${layout}/bezel.png`} alt="" style={{ left: 0, top: 0, width: px(TV.size[0]), height: px(TV.size[1]) }} />
        {/* the lists name themselves (the stage picture needs no tag); the count at the right is the station on the dial or the row */}
        {mode !== "RADIO" && text(mode, L.title[0], L.title[1], L.title[2], TAG, false, false, "title")}
        {mode !== "RADIO" && <i className="tv-rule" style={{ left: px(cx), top: px(L.title[1] + L.title[2] * 0.4), width: px(cw) }} />}
        {(mode === "RADIO" || total > 0) && text(mode === "RADIO" ? `${String(station + 1).padStart(2, "0")} / ${STATIONS.length}` : `${at + 1} / ${total}`, L.page[0], L.page[1], L.page[2], COUNT, true, true, "count", undefined, TV.size[0])}
        {(busy || trouble) && <i className="hu-dot" style={{ left: px(L.page[0] - 12), top: px(L.page[1] + 8), borderColor: trouble ? ACCENT : DISPLAY }} />}
        {mode === "RADIO" && !tuning && (
          <>
            {text(stage.title, TV.title.baseline[0], TV.title.baseline[1], TV.title.size, TITLE, false, false, "stage", TV.title.maxWidth)}
            {conditions.map(([icon, word, c], k) => (
              <span key={k}>
                <img src={`${ICON}${icon}-32.png`} alt="" style={{ left: px(TV.cond.x[k] - TV.cond.icon * 1.33), top: px(TV.condY - TV.cond.icon * 0.85), width: px(TV.cond.icon), height: px(TV.cond.icon) }} />
                {text(word, TV.cond.x[k], TV.condY, TV.cond.size, c)}
              </span>
            ))}
          </>
        )}
        {windowRows.map((row, j) => {
          const i = start + j, [rx, ry, rw, rh] = L.sel[j], base = L.baselines[j] - ry, [ix, iw] = L.icon;
          // a cell's column: x, size, mono, right aligned; the row's own box is the selection rect
          const col = (c: Cell): [number, number, boolean, boolean] => c.col === "num" ? [L.num[0], L.num[1], true, false] : c.col === "name" ? [L.name[0], L.name[1], true, false] : c.col === "score" ? [L.score[0], L.score[1], true, true] : c.col === "state" ? [L.state[0], L.state[1], false, false] : [cx + cw - 8, L.num[1], true, true];
          return (
            <div key={row.key} className="hu-row" style={{ left: px(rx), top: px(ry), width: px(rw), height: px(rh) }} onClick={() => (mode === "RADIO" ? setStation(i) : setCursor({ ...cursor, [mode]: i }), i === at && select())}>
              {i === at && <img src={`${ART}tv/${layout}/selection.png`} alt="" style={{ position: "absolute", left: 0, top: 0, width: px(rw), height: px(rh) }} />}
              {row.cells.map((c, k) => {
                if (c.icon) return <img key={k} src={`${ICON}${c.icon}-32.png`} alt={c.icon} style={{ position: "absolute", left: px(ix - rx), top: px((rh - iw) / 2), width: px(iw), height: px(iw) }} />;
                const [x, size, mono, right] = col(c);
                return text(c.t, x - rx, base, size, c.c ?? CREAM, mono, right, k, right ? x - rx - 8 : (c.col === "state" ? ix - 12 : c.col === "name" ? L.score[0] - L.score[1] * 4 : L.name[0] - 4) - x, rw);
              })}
            </div>
          );
        })}
        {statusLines && (
          <div className={`hu-status${tuning && !busy && !trouble && !note && !status ? " tv-tuning" : ""}`} style={{ left: px(sx + 24), top: px(sy + 40), width: px(sw - 48), height: px(sh - 56), fontSize: px(TV.title.size * 0.6), color: trouble ? ACCENT : DISPLAY }}>
            {statusLines.map((l, i) => <p key={i} style={i ? { color: DIM, fontSize: px(TV.title.size * 0.42) } : {}}>{l}</p>)}
          </div>
        )}
        {/* the glass last: scanlines and phosphor over the picture and the text alike (the text was over the glass before) */}
        <img src={`${ART}tv/${layout}/glass.png`} alt="" style={{ left: 0, top: 0, width: px(TV.size[0]), height: px(TV.size[1]) }} />
      </div>
      {/* the radio */}
      <div className="hu-unit" style={{ left: px(G.origin[0]), top: px(G.origin[1]), width: px(G.size[0]), height: px(G.size[1]) }}>
        <img src={`${ART}menu/${layout}/fascia.png`} alt="" style={{ left: 0, top: 0, width: px(G.size[0]), height: px(G.size[1]) }} />
        {/* lower LCD: the radio keeps playing while you browse: the station index, the 13-slot band and the volume */}
        {text(String(station + 1).padStart(2, "0"), G.lcdBaseline[0], G.lcdBaseline[1], 25, LCD, true, false, "idx")}
        {STATIONS.map((_, i) => <i key={i} className="hu-tick" style={{ left: px(G.needle.range[0] + i * (G.needle.range[1] - G.needle.range[0]) / 12), top: px(G.needle.tipY), height: px(layout === "desktop" ? 10 : 7), background: i === station ? DISPLAY : TICK }} />)}
        <i className="hu-needle" style={{ left: px(needleX - 4), top: px(G.needle.tipY - 9), borderTopColor: DISPLAY }} />
        {text(`VOL ${Math.round(volume * 100)}%${muted ? "  MUTE" : ""}`, G.volBaseline[0], G.volBaseline[1], 12, LCD_DIM, true, false, "vol", lw - (G.volBaseline[0] - lx) - 8)}
        {/* controls */}
        {G.controls.map((c) => {
          const r = c.rect;
          return (
          <span key={c.id}>
            <img src={`${ART}menu/${layout}/${c.id}-${state(c)}.png`} alt="" style={{ left: px(r[0]), top: px(r[1]), width: px(r[2]), height: px(r[3]) }} />
            {c.id === "vol" ? c.hits!.map((h, k) => <button key={k} className="hit" aria-label={k ? "Volume up" : "Volume down"} style={{ left: px(h[0]), top: px(h[1]), width: px(h[2]), height: px(h[3]) }} onClick={() => press(c.id, () => act(c, k as 0 | 1))} />)
              : <button className="hit" aria-label={c.id === "action" ? action ?? "" : c.label} disabled={disabled(c)} style={{ left: px(r[0]), top: px(r[1]), width: px(r[2]), height: px(r[3]) }} onClick={() => press(c.id, () => act(c))} onMouseEnter={c.id === "action" ? () => setHover(true) : undefined} onMouseLeave={c.id === "action" ? () => setHover(false) : undefined} />}
          </span>
          );
        })}
        {/* the action key's label, centred on the key: DRIVE, SHOT, COLLECT, CONNECT... */}
        {action && <span className="hu-text hu-gt hu-label" style={{ left: px(G.label.centre[0] - G.label.maxWidth / 2), top: px(labelTop), width: px(G.label.maxWidth), fontSize: px(G.label.size), color: disabled(act0) ? G.label.disabledFill : G.label.fill }}>{action}</span>}
      </div>
    </div>
  );
}
