// The head unit (the designer's approved painting, cut into pieces: PUB-Painted-Menu, 2026-10-17): a curved CRT above a black electronic GRAND PRIX stereo. The TV is
// passive, every input is a key on the radio: four named mode keys (SOLO RUN, CHALLENGE, MY RUNS, HIGH-SCORES) and two
// utility keys (WALLET, SYSTEM); BACK and ENTER; PREV and NEXT; the programmable red key, which reads the one action the
// screen allows (DRIVE, SHOT, COLLECT, CONNECT, WAIT) or stays dark; VOL, MUTE, POWER. The LCD states the mode's purpose
// and meters the menu music. Posting a run stays on the results screen. Geometry from game/data/menu.json (the pack's
// component-contracts.json, trimmed by a one-off, the painting's own text positions measured in), the layers under art/gp/{layout}.
import { useEffect, useRef, useState } from "react";
import { baselineEm, px, store, stored, useFit } from "./board";
import geometry from "./game/data/menu.json";
import { ART } from "./game/art";
import { STATIONS, type Station } from "./game/stations";
import { NAME } from "./game/sim";
import { audio } from "./audio";
import type { ChainApi, ChallengeNote } from "./chain/ChainHost";
import { blocksToClock as clock, fmtGc as gc, sameAccount as same, sameWord } from "./chain/flow";
import { boards, history, owed as owedNotes } from "./chain/hub";
import { noteDeadline } from "./chain/notes";

type Mode = "solo" | "challenge" | "my-runs" | "high-scores" | "wallet" | "system";
const MODES: Mode[] = ["solo", "challenge", "my-runs", "high-scores", "wallet", "system"];
type Word = "drive" | "shot" | "collect" | "connect" | "wait";
// The painted concept's lettering has no font (the painted pack's own limit). Stand-ins until the font pass: Boomer GT on
// headings and names, PUB Stereo LCD (the designer's dot-matrix derivative) on the LCD, counters, scores, clocks and the
// red key's word, Chakra Petch on small labels and states.
type Font = "gt" | "lcd" | "cp";
const FAMILY: Record<Font, string> = { gt: "Boomer GT", lcd: "PUB Stereo LCD", cp: "Chakra Petch" };
// the LCD's one line per mode (the pack's copy)
const PURPOSE: Record<Mode, string> = { solo: "PICK A STAGE AND DRIVE", challenge: "BEAT A CHAMPION", "my-runs": "YOUR RUNS AND WINNINGS", "high-scores": "THE BEST SCORES", wallet: "YOUR WALLET AND COINS", system: "SET UP YOUR GAME" };
// the pack's palette
const AMBER = "#ffd16b", WHITE = "#e6d5b8", CYAN = "#a3dbd5", PINK = "#f28bb1";
const GP = `${ART}gp/`;
type G = (typeof geometry)["desktop"];
type Cell = { t: string; x: number; y?: number; size: number; font: Font; color: string; right?: boolean; width?: number };
type Row = { key: string; cells: Cell[] };
/** What a review shows: the record under review, a funded shot, one of my runs */
type Review = { heading: string; label: string; score: number; line: string; tone?: string; song: number; left?: number };
/** One of my runs: a record or a shot, live or finished */
type Run = { key: string; kind: "record" | "shot"; score: number; state: string; line: string; tone?: string; song: number; label: string; deadline?: number; word?: "collect" | "drive"; shots?: ChallengeNote[]; record?: ChallengeNote };

/** Every score on the menu: five digits at least, zero padded, no separators (the pack's rule; results and HUD keep theirs) */
const score = (n: number) => String(n).padStart(5, "0");
const pad2 = (n: number) => String(n).padStart(2, "0");
const songOf = (i: number) => STATIONS[i]?.title ?? `SONG ${i}`;
// the TV's painting of a stage: the district at its hour, rain or not
const previewOf = (st: Station) => `${ART}stage/${st.district}-${st.time}${st.rain ? "-rain" : ""}.png`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const cell = (t: string, x: number, size: number, font: Font, color: string, right = false, width?: number, y?: number): Cell => ({ t, x, y, size, font, color, right, width });
// what the TV says while the chain works (the pack's phases); the purpose line on the LCD never changes
const PHASE: Record<string, string> = { prepare: "GETTING READY", wallet: "CHECK YOUR WALLET", network: "SENDING" };
const TONE: Record<string, string> = { COLLECT: AMBER, READY: AMBER, LOST: PINK, BEATEN: PINK, WON: CYAN, DEFENDED: CYAN };

/** The music meter: six columns of eight segments on the pack's bed, fed by the analyser at 20 Hz (35 ms attack, 180 ms
 * release); still under reduced motion, dark when muted */
function Meter({ layout, m }: { layout: string; m: G["radio"]["meter"] }) {
  const [v, setV] = useState([0, 0, 0, 0, 0, 0]);
  useEffect(() => {
    if (reduced()) return;
    let cur = [0, 0, 0, 0, 0, 0];
    const t = setInterval(() => { const b = audio.bands(); cur = cur.map((x, i) => x + (b[i] - x) * (b[i] > x ? 0.76 : 0.24)); setV(cur); }, 50);
    return () => clearInterval(t);
  }, []);
  const [x0, y0, w, h] = m.rect;
  return (
    <>
      <img src={`${GP}${layout}/meter-bed.png`} alt="" style={{ left: px(x0), top: px(y0), width: px(w), height: px(h) }} />
      {v.flatMap((lvl, c) => Array.from({ length: 8 }, (_, i) => (lvl * 8 > i + 0.5 ? <i key={`${c}-${i}`} className="gp-seg" style={{ left: px(x0 + c * m.pitch[0]), top: px(y0 + (7 - i) * m.pitch[1]), width: px(m.seg[0]), height: px(m.seg[1]), backgroundImage: `url(${GP}${layout}/meter-seg.png)` }} /> : null)))}
    </>
  );
}

export default function HeadUnit({ chain, station, setStation, volume, setVolume, muted, toggleMute, onDrive, onShot, onOff, openRecord, onOpened }: {
  chain: ChainApi | null;
  station: number; setStation: (i: number) => void;
  volume: number; setVolume: (v: number) => void; muted: boolean; toggleMute: () => void;
  onDrive: () => void;
  /** DRIVE on a funded shot: the record's course and song */
  onShot: (shots: ChallengeNote[], record: ChallengeNote) => void;
  /** POWER: the unit off, back to the splash */
  onOff: () => void;
  /** a record opened by link: the head unit starts on its review */
  openRecord: ChallengeNote | null;
  onOpened: () => void;
}) {
  const { layout, scale, left, top } = useFit(geometry);
  const G = geometry[layout] as G, TV = G.tv, R = G.radio, C = TV.cols, N = TV.rows.baselines.length;
  const u = TV.heading[2] / 34; // the TV's type scale: 1 on desktop, 0.59 on phones
  const [mode, setMode] = useState<Mode>("solo");
  const [cursor, setCursor] = useState<Record<string, number>>({}); // the row (or page) per mode, kept across mode changes
  const [review, setReview] = useState<ChallengeNote | null>(null); // CHALLENGE: the record under review
  const [opened, setOpened] = useState<string | null>(null); // MY RUNS: the run opened, by key
  const [ready, setReady] = useState<{ shots: ChallengeNote[]; record: ChallengeNote } | null>(null); // a shot funded here: DRIVE
  const [note, setNote] = useState<string | null>(null); // a line of our own on the TV (coins received, best cleared)
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set()); // the paintings the TV can show
  const [, setTick] = useState(0);
  const lastWord = useRef<Word | null>(null); // what the red key read when the chain was asked: TRY AGAIN offers it again

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []); // the clocks
  useEffect(() => { void document.fonts.ready.then(() => setTick((n) => n + 1)); }, []); // baselines need the fonts measured
  useEffect(() => { if (!openRecord) return; setMode("challenge"); setReview(openRecord); onOpened(); }, [openRecord, onOpened]);
  useEffect(() => { // every stage's painting warms up at once; TUNING shows until the current one is in
    for (const st of STATIONS) { const src = previewOf(st), img = new Image(); img.onload = () => setLoaded((s) => new Set(s).add(src)); img.src = src; }
  }, []);
  // the stage comes back as it was last chosen (the first one cold)
  useEffect(() => { const s = Number(stored("pub.stage")); if (Number.isInteger(s) && s >= 0 && s < STATIONS.length) setStation(s); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store("pub.stage", String(station)); }, [station]);

  const me = chain?.me ?? null, height = chain?.height ?? 0, notes = chain?.notes ?? [], busy = chain?.busy ?? null, trouble = chain?.trouble ?? null;
  const loading = !chain?.ready || !chain.notesRead;
  const champion = (n: ChallengeNote) => chain?.nameOf(n.storage.champion) ?? "???";
  const rival = (n: ChallengeNote) => (n.storage.rival && chain?.nameOf(n.storage.rival)) ?? "???";
  const songIn = (n: ChallengeNote) => Number(n.storage.game[4] ?? 0n);
  const over = (n: ChallengeNote) => n.consumed || height >= n.storage.expiryBlock - 140;
  // the lists behind the modes
  const records = notes.filter((n) => n.kind === "record" && !over(n) && n.amount > 0n && !same(me, n.storage.champion)).sort((a, b) => a.storage.target - b.storage.target);
  const owed = owedNotes(notes, height, me);
  const runs: Run[] = me ? [
    ...owed.map((n): Run => ({ key: n.id, kind: n.kind, score: n.storage.target, state: "COLLECT", line: `${gc(n.amount)} TO COLLECT`, song: songIn(n), label: n.kind === "record" ? "YOUR SCORE" : `${rival(n)} LOST`, word: "collect" })),
    ...notes.filter((n) => n.kind === "record" && !n.consumed && same(me, n.storage.champion) && !owed.includes(n)).map((n): Run => ({ key: n.id, kind: "record", score: n.storage.target, state: "OPEN", line: "OPEN", song: songIn(n), label: "YOUR SCORE", deadline: n.storage.expiryBlock - height })),
    ...notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.rival) && height < noteDeadline(n)).map((n): Run => ({ key: n.id, kind: "shot", score: n.storage.target, state: "READY", line: "SHOT READY", song: songIn(n), label: `CHAMPION ${champion(n)}`, deadline: noteDeadline(n) - height, word: "drive", shots: [n], record: notes.find((r) => r.kind === "record" && !r.consumed && sameWord(r.idWord, n.storage.recordId)) })),
    ...notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.champion) && !same(me, n.storage.rival) && !owed.includes(n)).map((n): Run => ({ key: n.id, kind: "shot", score: n.storage.target, state: "IN PLAY", line: `${rival(n)} SHOOTING`, song: songIn(n), label: "YOUR SCORE" })),
    // the finished games (hub.ts history): BEATEN, DEFENDED, TAKEN BACK, WON, LOST and the money that moved
    ...history(notes, me, height, (a) => chain!.nameOf(a)).map((h): Run => { const n = notes.find((x) => x.id === h.id); return { key: h.id, kind: h.kind, score: h.score, state: h.result.replace(/^You /, "").toUpperCase(), line: h.money.toUpperCase(), tone: h.tone, song: n ? songIn(n) : 0, label: h.kind === "shot" ? `CHAMPION ${h.context.split("'")[0]}` : "YOUR SCORE" }; }),
  ] : [];
  const best = boards(notes, height, me).records, seen = new Set<string>();
  const ranked = [...best.top, ...(best.mine ? [best.mine] : [])].filter((r) => !seen.has(`${r.who.prefix}:${r.who.suffix}`) && seen.add(`${r.who.prefix}:${r.who.suffix}`)); // one row per player

  // what the mode shows on the TV, and what the keys do there
  const cur = cursor[mode] ?? 0;
  let word: Word | null = null, go: (() => void) | null = null, enter: (() => void) | null = null;
  let heading = "", count = "", rows: Row[] = [], total = 0, at = 0, start = 0, selected = -1, footer: Cell[] = [], status: [string, string?] | null = null, rev: Review | null = null;
  const list = (n: number) => { total = n; at = Math.min(cur, Math.max(0, n - 1)); start = Math.min(Math.max(0, at - N + 1), Math.max(0, n - N)); selected = at; };
  const kv = (pairs: [string, string, (() => void)?][], valueFont: Font, valueColor: string) => {
    list(pairs.length);
    rows = pairs.map(([k, v], i) => ({ key: k, cells: [cell(k, C["my-runs"].type, C["wallet-system"].keyS, "cp", i === at ? AMBER : CYAN), cell(v, C["wallet-system"].valueR, C["wallet-system"].valueS, valueFont, valueColor, true)] }));
    enter = pairs[at]?.[2] ?? null;
  };
  const stage = STATIONS[station], preview = previewOf(stage), tuning = mode === "solo" && !loaded.has(preview);
  if (mode === "solo") {
    word = "drive"; go = onDrive;
    if (tuning) status = ["TUNING"];
  } else if (mode === "challenge") {
    heading = "CHALLENGE";
    if (review) {
      const r = review, mine = same(me, r.storage.champion), done = over(r);
      rev = { heading: ready ? "SHOT READY" : done ? "RECORD OVER" : "CHALLENGE", label: `CHAMPION ${champion(r)}`, score: r.storage.target, line: ready ? "PRESS DRIVE" : mine ? "YOUR OWN RECORD" : "", song: songIn(r), left: done ? undefined : r.storage.expiryBlock - height };
      if (ready) { const rd = ready; word = "drive"; go = () => onShot(rd.shots, rd.record); }
      else if (!done && !mine) { word = "shot"; go = () => void chain?.shoot(r).then((x) => x && setReady(x)); }
    } else if (loading) status = ["LOADING"];
    else if (!records.length) status = ["NO CHALLENGES YET"];
    else {
      list(records.length); count = `${records.length} OPEN`;
      rows = records.map((n, i) => ({ key: n.id, cells: [cell(champion(n), C.challenge.champion, C.challenge.nicknameS, "gt", i === at ? AMBER : WHITE), cell(score(n.storage.target), C.challenge.scoreR, C.challenge.scoreS, "lcd", AMBER, true), cell(songOf(songIn(n)), C.challenge.stage, C.challenge.stageS, "cp", i === at ? AMBER : WHITE, false, C.challenge.stageW)] }));
      const s = records[at];
      footer = [cell(songOf(songIn(s)), TV.safe[0], TV.review.stageS, "gt", AMBER, false, undefined, TV.footer), cell("TIME LEFT", TV.count[0], 14 * u, "cp", CYAN, true, undefined, TV.detail - 4 * u), cell(clock(s.storage.expiryBlock - height), TV.count[0], TV.review.expiryS, "lcd", AMBER, true, undefined, TV.footer + 4 * u)];
      enter = () => setReview(s);
    }
  } else if (mode === "my-runs") {
    heading = "MY RUNS";
    const o = opened ? runs.find((r) => r.key === opened) : null;
    if (!me) { status = [chain?.connecting ? chain.walletStatus || "CONNECTING" : "CONNECT YOUR WALLET"]; if (!chain?.connecting && chain?.installed) { word = "connect"; go = () => void chain.connect(); } }
    else if (o) {
      rev = { heading: o.word === "drive" ? "SHOT READY" : o.kind === "record" ? "MY RECORD" : "MY SHOT", label: o.label, score: o.score, line: o.word === "drive" ? "PRESS DRIVE" : o.line, tone: o.tone, song: o.song, left: o.deadline };
      if (o.word === "collect") { word = "collect"; go = () => void chain?.collect(owed).then((ok) => ok && setNote("COINS RECEIVED")); } // everything owed, one transaction
      else if (o.word === "drive") { word = "drive"; go = () => onShot(o.shots!, o.record!); }
    } else if (loading) status = ["LOADING"];
    else if (!runs.length) status = ["NO RUNS YET"];
    else {
      list(runs.length); count = `${runs.length} RUNS`;
      rows = runs.map((r, i) => ({ key: r.key, cells: [cell(r.kind.toUpperCase(), C["my-runs"].type, C["my-runs"].typeS, "gt", i === at ? AMBER : WHITE), cell(score(r.score), C["my-runs"].scoreR, C["my-runs"].scoreS, "lcd", AMBER, true), cell(r.state, C["my-runs"].stateR, C["my-runs"].stateS, "cp", i === at ? AMBER : TONE[r.state] ?? WHITE, true)] }));
      footer = [cell(runs[at].line, TV.safe[0], 24 * u, "cp", CYAN, false, undefined, TV.detail)];
      const k = runs[at].key; enter = () => setOpened(k);
    }
  } else if (mode === "high-scores") {
    heading = "HIGH-SCORES";
    if (loading) status = ["LOADING"];
    else if (!ranked.length) status = ["NO SCORES YET"];
    else { // PREV / NEXT turn the pages here, no row is selected
      const pages = Math.ceil(ranked.length / N), page = Math.min(cur, pages - 1);
      total = pages; at = page; count = `${pad2(page + 1)} / ${pad2(pages)}`;
      rows = ranked.slice(page * N, page * N + N).map((r, j) => ({ key: r.key, cells: [cell(`${page * N + j + 1} ${chain?.nameOf(r.who) ?? "???"}`, C["high-scores"].name, C.challenge.nicknameS, "gt", same(me, r.who) ? AMBER : WHITE), cell(score(r.value), C["high-scores"].scoreR, C["high-scores"].scoreS, "lcd", AMBER, true)] }));
      if (pages > 1) footer = [cell("PREV / NEXT", TV.safe[0], 24 * u, "cp", CYAN, false, undefined, TV.detail)];
    }
  } else if (mode === "wallet") {
    heading = "WALLET";
    kv([
      ["STATUS", !chain?.installed ? "NO BREAD WALLET" : me ? "CONNECTED" : chain.connecting ? chain.walletStatus || "CONNECTING" : "NOT CONNECTED"],
      ["BALANCE", chain?.balance != null ? gc(chain.balance) : me ? "ENTER TO READ" : "--", me ? () => void chain?.readBalance() : undefined],
      ["NETWORK", "MIDEN TESTNET"],
      ...(me ? [["PLAYER", chain!.nameOf(me)], ["GAMECOINS", "GET 10", () => void chain?.gamecoins().then((m) => m && setNote(m))], ["DISCONNECT", "ENTER", () => void chain?.disconnect()]] as [string, string, (() => void)?][] : []),
    ], "lcd", AMBER);
    if (!me && chain?.installed && !chain.connecting) { word = "connect"; go = () => void chain.connect(); }
  } else {
    heading = "SYSTEM";
    const bestScore = Number(stored("pub.best") ?? 0);
    kv([
      ["SOUND", muted ? "OFF" : "ON", toggleMute],
      ["VOLUME", `${Math.round(volume * 100)}%`, () => setVolume(volume >= 0.95 ? 0 : Math.min(1, volume + 0.1))],
      ["RESET BEST", bestScore ? score(bestScore) : "--", bestScore ? () => { store("pub.best", null); setNote("BEST SCORE CLEARED"); } : undefined],
      ["VERSION", __PUB_VERSION__],
      ["WALLET", chain?.local ? "TEST (?LOCAL=)" : "BREAD"],
    ], "cp", WHITE);
  }
  // the chain's say comes over the mode's own screen: the phase while it works, the trouble after, our own note
  if (busy) { status = [busy.stage === "connect" ? chain?.walletStatus || "CONNECTING" : PHASE[busy.stage] ?? busy.text, "PLEASE WAIT"]; word = "wait"; go = null; rev = null; }
  else if (trouble) { status = [trouble.retry ? "TRY AGAIN" : trouble.t.title.toUpperCase(), trouble.t.detail]; rev = null; word = trouble.retry ? lastWord.current : null; go = trouble.retry ? () => { const r = trouble.retry!; chain?.dismiss(); r(); } : null; }
  else if (note) { status = [note]; rev = null; word = null; go = null; }

  // which keys answer, by the pack's rules: a root has no BACK, ENTER opens rows only, the arrows stop at a list's ends
  // (the stages wrap), nothing but VOL and MUTE while the chain works
  const root = !review && !opened && !note && !trouble;
  const on = (id: string): boolean => {
    if (busy) return id === "volume" || id === "mute";
    switch (id) {
      case "back": return !root;
      case "enter": return !!enter && !status && !rev;
      case "prev": return mode === "solo" || (!status && !rev && at > 0);
      case "next": return mode === "solo" || (!status && !rev && at < total - 1);
      case "action": return !!word && !!go;
      default: return true;
    }
  };
  const goMode = (m: Mode) => { setMode(m); setReview(null); setOpened(null); setReady(null); setNote(null); chain?.dismiss(); };
  const back = () => { if (trouble) return chain?.dismiss(); if (note) return setNote(null); if (ready) return setReady(null); if (review) return setReview(null); setOpened(null); };
  const stepTo = (d: number) => { if (mode === "solo") return setStation((station + d + STATIONS.length) % STATIONS.length); if (total) setCursor({ ...cursor, [mode]: Math.max(0, Math.min(total - 1, at + d)) }); };
  const act = (id: string, half?: 0 | 1) => {
    if (!on(id)) return;
    if (MODES.includes(id as Mode)) return goMode(id as Mode);
    switch (id) {
      case "prev": return stepTo(-1);
      case "next": return stepTo(1);
      case "back": return back();
      case "enter": return enter?.();
      case "action": if (swapping.current) return; lastWord.current = word; return go?.();
      case "volume": return setVolume(Math.max(0, Math.min(1, volume + (half === 0 ? -0.1 : 0.1))));
      case "mute": return toggleMute();
      case "power": return onOff();
    }
  };
  const press = (id: string, half?: 0 | 1) => { setPressed(id); setTimeout(() => setPressed(null), 80); act(id, half); };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Enter" && (e.target as HTMLElement).tagName === "BUTTON") return; // the focused key answers Enter itself
      if (k >= "1" && k <= "6") act(MODES[Number(k) - 1]);
      else if (k === "ArrowLeft" || k === "ArrowUp") act("prev");
      else if (k === "ArrowRight" || k === "ArrowDown") act("next");
      else if (k === "Enter") act("enter");
      else if (k === "Escape" || k === "Backspace") act("back");
      else if (k === "d" && word === "drive") act("action"); // D drives, never shoots or collects
      else if (k === "m") act("mute");
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  });

  // the red key's legend: on a real change of the available action the old word closes to its centreline (60 ms), the cap
  // stays bare (20 ms), the new word opens (80 ms), a glint settles (40 ms); no click lands during the 200 ms; an instant
  // swap under reduced motion (the kit's motion contract)
  const [shown, setShown] = useState<Word | null>(word);
  const [phase, setPhase] = useState<"out" | "in" | null>(null);
  const wordRef = useRef(word), swapping = useRef(false);
  wordRef.current = word;
  useEffect(() => {
    if (word === shown || swapping.current) return;
    if (reduced()) return setShown(word);
    swapping.current = true; setPhase("out");
    setTimeout(() => { setShown(wordRef.current); setPhase("in"); }, 80);
    setTimeout(() => { swapping.current = false; setPhase(null); setShown(wordRef.current); }, 200);
  }, [word, shown]);

  // the faces: rest, hover (pointer), pressed, selected (the mode's key, MUTE on), disabled
  const lit = (id: string) => id === mode || (id === "mute" && muted);
  const face = (id: string) => (pressed === id ? (lit(id) ? "selected-pressed" : "pressed") : !on(id) ? "disabled" : lit(id) ? "selected" : hover === id ? "hover" : "rest");
  const box = (r: number[]) => ({ left: px(r[0]), top: px(r[1]), width: px(r[2]), height: px(r[3]) });
  /** Text on its baseline inside the TV */
  const text = (t: string, x: number, baseline: number, size: number, font: Font, color: string, right = false, key?: string | number, width?: number) => (
    <span key={key} className={`gp-text gp-${font}`} style={{ [right ? "right" : "left"]: px(right ? TV.size[0] - x : x), top: px(baseline - baselineEm(FAMILY[font]) * size), fontSize: px(size), color, maxWidth: width ? px(width) : undefined }}>{t}</span>
  );
  const cells = (cs: Cell[], baseline?: number) => cs.map((c, k) => text(c.t, c.x, c.y ?? baseline ?? 0, c.size, c.font, c.color, c.right, k, c.width));
  // the stage's conditions: district, light, weather, each an icon and a word, on a baseline
  const cond = (song: number, baseline: number) => {
    const st = STATIONS[song], items: [string, string][] = [["location", NAME[st.district]], [st.time, st.time.toUpperCase()], [st.rain ? "rain" : "clear", st.rain ? "RAIN" : "CLEAR"]];
    return TV.cond.map((c, k) => (
      <span key={k}>
        <img src={`${GP}icons/${items[k][0]}.png`} alt="" style={{ left: px(c.icon[0]), top: px(baseline - (c.text[1] - c.icon[1])), width: px(c.icon[2]), height: px(c.icon[3]) }} />
        {text(items[k][1], c.text[0], baseline, c.text[2], "gt", AMBER)}
      </span>
    ));
  };
  const brand = (r: number[], side: "left" | "right") => <img src={`${GP}brand.png`} alt="PICK UP BOOMERS" style={{ [side]: px(side === "left" ? r[0] : TV.size[0] - r[0] - r[2]), top: px(r[1]), width: px(r[2]) }} />;
  const mid = TV.safe[1] + TV.safe[3] * 0.49;
  const action = R.controls.find((c) => c.id === "action")!, cap = box([0, 0, action.rect[2], action.rect[3]]);

  return (
    <div className="gp-screen" style={{ left: px(left), top: px(top), width: px(G.canvas[0]), height: px(G.canvas[1]), transform: `scale(${scale})` }}>
      {/* the TV: the content clipped by the tube's curve, the bezel, the glass over everything */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <clipPath id={`gp-tube-${layout}`} clipPathUnits="userSpaceOnUse"><path transform={`scale(${TV.size[0] / TV.native[0]} ${TV.size[1] / TV.native[1]})`} d={TV.path} /></clipPath>
      </svg>
      <div className="gp-tv" style={box([...TV.origin, ...TV.size])}>
        <div className="gp-content" style={{ width: px(TV.size[0]), height: px(TV.size[1]), clipPath: `url(#gp-tube-${layout})` }}>
          {mode === "solo" && !status && (
            <>
              <img className="gp-pic" src={preview} alt="" />
              <div className="gp-shade" />
              {brand(TV.scene.logo, "left")}
              {text(`${pad2(station + 1)} / ${pad2(STATIONS.length)}`, TV.count[0], TV.count[1], TV.count[2], "gt", AMBER, true)}
              {text(stage.title, TV.scene.title[0], TV.scene.title[1], TV.scene.title[2], "gt", WHITE)}
              {cond(station, TV.cond[0].text[1])}
            </>
          )}
          {mode !== "solo" && !status && !rev && (
            <>
              {text(heading, TV.heading[0], TV.heading[1], TV.heading[2], "gt", AMBER)}
              {brand(TV.brand, "right")}
              {count && text(count, TV.count[0], TV.count[1], TV.count[2], "lcd", CYAN, true)}
              {rows.slice(start, start + N).map((row, j) => {
                const i = start + j, r = TV.rows.sel[j];
                return (
                  <span key={row.key}>
                    {i === selected && <img src={`${GP}${layout}/row.png`} alt="" style={box(r)} />}
                    {i === selected && <img src={`${GP}icons/cursor.png`} alt="" style={{ left: px(r[0] + 5 * u), top: px(r[1] + r[3] / 2 - 6 * u), width: px(12 * u), height: px(12 * u) }} />}
                    {cells(row.cells, TV.rows.baselines[j])}
                  </span>
                );
              })}
              {cells(footer)}
            </>
          )}
          {rev && !status && (
            <>
              {text(rev.heading, TV.heading[0], TV.heading[1], TV.heading[2], "gt", AMBER)}
              {brand(TV.brand, "right")}
              {text(rev.label, TV.review.champion[0], TV.review.champion[1], 24 * u, "cp", CYAN)}
              {text(score(rev.score), TV.review.score[0], TV.review.score[1], TV.review.scoreS, "lcd", AMBER)}
              {rev.line && text(rev.line, TV.review.score[0], TV.review.score[1] + 66 * u, 28 * u, "gt", rev.tone === "pink" ? PINK : WHITE)}
              {text(songOf(rev.song), TV.review.stage[0], TV.review.stage[1], TV.review.stageS, "gt", WHITE)}
              {cond(rev.song, TV.review.conditions)}
              {rev.left !== undefined && text(`TIME LEFT ${clock(rev.left)}`, TV.review.expiry[0], TV.review.expiry[1], TV.review.expiryS, "lcd", CYAN)}
            </>
          )}
          {status && (
            <>
              {brand(TV.brand, "right")}
              {text(status[0], TV.safe[0], mid, TV.heading[2], "gt", trouble && !trouble.retry ? PINK : AMBER, false, undefined, TV.safe[2])}
              {status[1] && <p className="gp-para gp-cp" style={{ left: px(TV.safe[0]), top: px(mid + 34 * u), width: px(TV.safe[2]), fontSize: px(20 * u), color: CYAN }}>{status[1]}</p>}
            </>
          )}
          <img src={`${GP}${layout}/crt.png`} alt="" style={box([0, 0, ...TV.size])} />{/* scanlines, phosphor, edge shade, sheen: one layer over picture, logo and text */}
        </div>
        <img src={`${GP}${layout}/tv-shell.png`} alt="" style={box([0, 0, ...TV.size])} />
      </div>
      {/* the radio: the painted body with its wells open, the LCD glass, the mode's purpose line and the meter, the plaque, then the keys in their wells */}
      <div className="gp-radio" style={box([...R.origin, ...R.size])}>
        <img src={`${GP}${layout}/fascia.png`} alt="" style={box([0, 0, ...R.size])} />
        <img src={`${GP}${layout}/lcd.png`} alt="" style={box(R.lcd)} />
        <span className="gp-text gp-lcd" style={{ left: px(R.purpose[0]), top: px(R.purpose[1] - baselineEm(FAMILY.lcd) * R.purpose[2]), fontSize: px(R.purpose[2]), color: AMBER }}>{PURPOSE[mode]}</span>
        <Meter layout={layout} m={R.meter} />
        <img src={`${GP}${layout}/plaque.png`} alt="electronic GRAND PRIX" style={box(R.plaque)} />
        {R.controls.map((c) => {
          if (c.id === "action") return null;
          const parts = "parts" in c ? c.parts : null;
          const hit = (r: number[], half?: 0 | 1, label?: string) => <button key={half} className="hit" aria-label={label ?? c.id.replace("-", " ").toUpperCase()} aria-pressed={lit(c.id) || undefined} disabled={!on(c.id)} style={box(r)} onClick={() => press(c.id, half)} onMouseUp={(e) => e.currentTarget.blur()} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} />;
          return (
            <span key={c.id}>
              <img src={`${GP}${layout}/${c.id}-${face(c.id)}.png`} alt="" style={box(c.rect)} />
              {parts ? [hit(parts[0], 0, "VOLUME DOWN"), hit(parts[1], 1, "VOLUME UP")] : hit(c.hit)}
              <img className="gp-focus" src={`${GP}${layout}/${c.id}-focus.png`} alt="" style={box(c.rect)} />
            </span>
          );
        })}
        {/* the red key: the painted red glass in its state, the word in LCD lettering over it (dim when it cannot be pressed), the glint, the hit */}
        <span className={`gp-key${pressed === "action" ? " down" : ""}`} style={box(action.rect)}>
          <img src={`${GP}${layout}/key/blank-${!on("action") ? "disabled" : pressed === "action" ? "pressed" : hover === "action" ? "hover" : "rest"}.png`} alt="" style={cap} />
          {shown && <span key={shown} className={`gp-legend gp-lcd${phase ? ` ${phase}` : ""}${on("action") || phase === "out" ? "" : " dim"}`} style={{ ...cap, fontSize: px(action.rect[3] * 0.6) }}>{shown.toUpperCase()}</span>}
          {phase === "in" && <img className="gp-glint" src={`${GP}${layout}/key/blank-hover.png`} alt="" style={cap} />}
          <button className="hit" aria-label={shown ? shown.toUpperCase() : "NO ACTION"} disabled={!on("action")} style={box([action.hit[0] - action.rect[0], action.hit[1] - action.rect[1], action.hit[2], action.hit[3]])} onClick={() => press("action")} onMouseUp={(e) => e.currentTarget.blur()} onMouseEnter={() => setHover("action")} onMouseLeave={() => setHover(null)} />
          <img className="gp-focus" src={`${GP}${layout}/key/focus.png`} alt="" style={cap} />
        </span>
      </div>
    </div>
  );
}
