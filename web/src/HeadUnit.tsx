// The head unit (the designer's approved painting, cut into pieces: PUB-Painted-Menu, 2026-10-17): a curved CRT above a black electronic GRAND PRIX stereo. The TV is
// passive, every input is a key on the radio: four named mode keys (SOLO RUN, CHALLENGE, MY RUNS, LEADERBOARDS) and two
// utility keys (WALLET, SYSTEM); BACK and ENTER; PREV and NEXT; the programmable red key, which reads the one action the
// screen allows (DRIVE, SHOT, COLLECT, CONNECT, WAIT) or stays dark; VOL, MUTE, POWER. The LCD states the mode's purpose
// and meters the menu music. Posting a run stays on the results screen. Geometry from game/data/menu.json (the pack's
// component-contracts.json, trimmed by a one-off, the painting's own text positions measured in), the layers under art/gp/{layout}.
import { useEffect, useRef, useState } from "react";
import { baselineEm, px, store, stored, useFit } from "./board";
import geometry from "./game/data/menu.json";
import { ART } from "./game/art";
import { STATIONS, type Station } from "./game/stations";
import { need, unlocked } from "./game/unlock";
import { NAME } from "./game/sim";
import { audio } from "./audio";
import type { ChainApi, ChallengeNote } from "./chain/ChainHost";
import { BREAD_URL, blocksToClock as clock, canDrive, fmtGamecoin, fmtPay, sameAccount as same, sameWord, waiting } from "./chain/flow";
import { boards, history, keyOf, owed as owedNotes } from "./chain/hub";
import { GC_DECIMALS, GC_PRICE, MAINNET, QUANTITIES, STAKE, STATUS_URL } from "./chain/config";
import { noteDeadline } from "./chain/notes";

type Mode = "solo" | "challenge" | "my-runs" | "leaderboards" | "wallet" | "system";
const MODES: Mode[] = ["solo", "challenge", "my-runs", "leaderboards", "wallet", "system"];
// the boards, one a page (GQ's, the LOSERBOARD last)
type BoardKey = keyof ReturnType<typeof boards>;
const BOARDS: [BoardKey, string][] = [["records", "BEST RECORDS"], ["coins", "MOST GAMECOINS WON"], ["defended", "RIVALS BEATEN"], ["smashed", "RECORDS SMASHED"], ["losers", "LOSERBOARD"]];
type Word = "drive" | "shot" | "collect" | "connect" | "gamecoins" | "buy" | "get bread" | "wait" | "try again" | "try another";
// The font pass (PUB-Painted-Type, Gaylord 2026-10-17: "much better"): PUB Painted Pixel for words and the counter, PUB Painted
// Matrix for numbers, the LCD line and the red key's word. The sizes in menu.json were set against the stand-ins (Chakra Petch,
// Share Tech Mono, PUB Stereo LCD); K keeps the cap heights they gave (caps at 100 px: the stand-ins and Pixel 70, Matrix 64.6, Stereo LCD 66.7)
type Font = "cp" | "mono";
const FAMILY: Record<Font, string> = { cp: "PUB Painted Pixel", mono: "PUB Painted Matrix" };
const K: Record<Font | "lcd", number> = { cp: 1, mono: 1.084, lcd: 1.033 };
const LCD = "PUB Painted Matrix";
// the LCD's one line per mode (the pack's copy)
const PURPOSE: Record<Mode, string> = { solo: "PICK A STAGE AND DRIVE", challenge: "BEAT A CHAMPION", "my-runs": "YOUR RUNS AND WINNINGS", leaderboards: "BEST AND WORST PLAYERS", wallet: "YOUR WALLET AND COINS", system: "SET UP YOUR GAME" };
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
const gc = (v: bigint) => fmtGamecoin(v).toUpperCase();
let owedTold: string | null = null; // the wallet told about its coins to collect, once a session (the head unit unmounts for every run) // spelled out on the TV (Gaylord 2026-10-18: GC was unclear)
// the TV's painting of a stage: the district at its hour, rain or not
const previewOf = (st: Station) => `${ART}stage/${st.district}-${st.time}${st.rain ? "-rain" : ""}.png`;
const DIM_TO = 0.08; // the mean brightness every CHALLENGE backdrop is dimmed to (paintings range 0.16 to 0.49; 0.045 lost the night ones, Gaylord 2026-10-23)
// a sentence or two for the TV: the first one is the heading (no period), the rest the paragraph
const headline = (s: string): [string, string] => { const [head, ...tail] = s.toUpperCase().split(". "); return [head.replace(/\.$/, ""), tail.join(". ")]; };
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}...` : s); // at a word
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const cell = (t: string, x: number, size: number, font: Font, color: string, right = false, width?: number, y?: number): Cell => ({ t, x, y, size, font, color, right, width });
const TONE: Record<string, string> = { COLLECT: AMBER, READY: AMBER, LATE: PINK, LOST: PINK, BEATEN: PINK, WON: CYAN, DEFENDED: CYAN };

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

export default function HeadUnit({ chain, station, setStation, volume, setVolume, muted, toggleMute, onDrive, onShot, onOff, openRecord, onOpened, opening, noBread }: {
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
  opening: boolean; // a record linked is still loading: CHALLENGE says so
  onOpened: () => void;
  /** no Bread in this browser: stages 2 and up lock, the red key offers it where the wallet would be asked for */
  noBread: boolean;
}) {
  const { layout, scale, left, top } = useFit(geometry);
  const G = geometry[layout] as G, TV = G.tv, R = G.radio, C = TV.cols, N = TV.rows.baselines.length;
  const u = TV.heading[2] / 34; // the TV's type scale: 1 on desktop, 0.59 on phones
  const [mode, setMode] = useState<Mode>(opening ? "challenge" : "solo");
  const [cursor, setCursor] = useState<Record<string, number>>({}); // the row (or page) per mode, kept across mode changes
  const [review, setReview] = useState<ChallengeNote | null>(null); // CHALLENGE: the record under review
  const [opened, setOpened] = useState<string | null>(null); // MY RUNS: the run opened, by key
  const [board, setBoard] = useState<BoardKey | null>(null); // LEADERBOARDS: the board opened
  const [shop, setShop] = useState<number | null>(null); // GET GAMECOINS: the quantity picked (an index into QUANTITIES), over any mode
  const [note, setNote] = useState<string | null>(null);
  const [noteUntil, setNoteUntil] = useState<number | null>(null); // a note that counts down and goes back to the track (COINS RECEIVED, Gaylord 2026-10-19)
  const noteTimer = useRef(0);
  const [health, setHealth] = useState<Record<string, string> | null>(null); // SYSTEM: the network monitor's word per service, {} when unreachable // a line of our own on the TV (coins received, best cleared)
  const [pressed, setPressed] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Map<string, number>>(() => new Map()); // the paintings the TV can show, each with its mean brightness (0..1)
  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => { clearInterval(t); clearTimeout(noteTimer.current); }; }, []); // the clocks (and a note's timer at unmount)
  useEffect(() => { void document.fonts.ready.then(() => setTick((n) => n + 1)); }, []); // baselines need the fonts measured
  useEffect(() => { if (!openRecord) return; setMode("challenge"); setReview(openRecord); onOpened(); }, [openRecord, onOpened]);
  useEffect(() => { // every stage's painting warms up at once; TUNING shows until the current one is in
    const c = document.createElement("canvas"), g = c.getContext("2d")!;
    for (const st of STATIONS) {
      const src = previewOf(st), img = new Image();
      img.onload = () => { // mean luminance, so the dimmed backdrops come out even (Gaylord 2026-10-19)
        c.width = img.width; c.height = img.height; g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        setLoaded((s) => new Map(s).set(src, sum / (d.length / 4) / 255));
      };
      img.src = src;
    }
  }, []);
  // the stage comes back as it was last chosen (the first one cold)
  useEffect(() => { const s = Number(stored("pub.stage")); if (Number.isInteger(s) && s >= 0 && s < STATIONS.length) setStation(s); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store("pub.stage", String(station)); }, [station]);
  // WALLET read once per connection on its first visit (Bread asks the player on every read); ENTER on BALANCE reads again
  useEffect(() => { if (mode !== "system") return; setHealth(null); fetch("/api/status").then((r) => r.json()).then(setHealth, () => setHealth({})); }, [mode]);

  const me = chain?.me ?? null, height = chain?.height ?? 0, notes = chain?.notes ?? [], busy = chain?.busy ?? null, trouble = chain?.trouble ?? null;
  const loading = !chain?.ready || !chain.notesRead;
  const champion = (n: ChallengeNote) => chain?.nameOf(n.storage.champion) ?? "???";
  const rival = (n: ChallengeNote) => (n.storage.rival && chain?.nameOf(n.storage.rival)) ?? "???";
  const songIn = (n: ChallengeNote) => Number(n.storage.game[4] ?? 0n);
  const over = (n: ChallengeNote) => n.consumed || height >= n.storage.expiryBlock - 140;
  // the lists behind the modes
  const records = notes.filter((n) => n.kind === "record" && !over(n) && n.amount > 0n && !same(me, n.storage.champion)).sort((a, b) => a.storage.target - b.storage.target);
  const owed = owedNotes(notes, height, me);
  // coins to collect, told once when the menu is idle with the notes read (Gaylord 2026-10-19): the red key collects, BACK leaves it to MY RUNS
  const [owedPop, setOwedPop] = useState(false);
  useEffect(() => { const a = chain?.address ?? null; if (a && !loading && owed.length && owedTold !== a) { owedTold = a; setOwedPop(true); } }, [chain?.address, loading, owed.length]);
  const pop = owedPop && owed.length > 0;
  const runs: Run[] = me ? [
    ...owed.map((n): Run => ({ key: n.id, kind: n.kind, score: n.storage.target, state: "COLLECT", line: `${gc(n.amount)} TO COLLECT`, song: songIn(n), label: n.kind === "record" ? "YOUR SCORE" : `${rival(n)} LOST`, word: "collect" })),
    ...notes.filter((n) => n.kind === "record" && !n.consumed && same(me, n.storage.champion) && !owed.includes(n)).map((n): Run => ({ key: n.id, kind: "record", score: n.storage.target, state: "OPEN", line: "OPEN", song: songIn(n), label: "YOUR SCORE", deadline: n.storage.expiryBlock - height })),
    // a shot too close to its deadline for the drive and the claim is LATE: driven anyway it would be refused at the claim (SQQ, 2026-10-18)
    ...notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.rival) && height < noteDeadline(n)).map((n): Run => ({ key: n.id, kind: "shot", score: n.storage.target, state: canDrive(n, height) ? "READY" : "LATE", line: canDrive(n, height) ? "SHOT READY" : "TOO LATE TO DRIVE", tone: canDrive(n, height) ? undefined : "pink", song: songIn(n), label: `CHAMPION ${champion(n)}`, deadline: noteDeadline(n) - height, word: canDrive(n, height) ? "drive" : undefined, shots: [n], record: notes.find((r) => r.kind === "record" && !r.consumed && sameWord(r.idWord, n.storage.recordId)) })),
    ...notes.filter((n) => n.kind === "shot" && !n.consumed && same(me, n.storage.champion) && !same(me, n.storage.rival) && !owed.includes(n)).map((n): Run => ({ key: n.id, kind: "shot", score: n.storage.target, state: "IN PLAY", line: `${rival(n)} SHOOTING`, song: songIn(n), label: "YOUR SCORE" })),
    // the finished games (hub.ts history): BEATEN, DEFENDED, TAKEN BACK, WON, LOST and the money that moved
    ...history(notes, me, height, (a) => chain!.nameOf(a)).map((h): Run => { const n = notes.find((x) => x.id === h.id); return { key: h.id, kind: h.kind, score: h.score, state: h.result.replace(/^You /, "").toUpperCase(), line: h.money.toUpperCase(), tone: h.tone, song: n ? songIn(n) : 0, label: h.kind === "shot" ? `CHAMPION ${h.context.split("'")[0]}` : "YOUR SCORE" }; }),
  ] : [];
  const best = boards(notes, height, me);
  const openShop = () => setShop((s) => s ?? QUANTITIES.indexOf(10)); // GET GAMECOINS, from WALLET, an empty MY RUNS and LEADERBOARDS
  const getBread = () => void window.open(BREAD_URL, "_blank", "noopener"); // no Bread here: the red key opens its page

  // what the mode shows on the TV, and what the keys do there
  const cursorKey = board ? `leaderboards/${board}` : mode, cur = cursor[cursorKey] ?? 0; // a board keeps its own page
  let word: Word | null = null, go: (() => void) | null = null, enter: (() => void) | null = null;
  let heading = "", count = "", rows: Row[] = [], total = 0, at = 0, start = 0, selected = -1, footer: Cell[] = [], status: [string, string?] | null = null, rev: Review | null = null, baselines = TV.rows.baselines, sel = TV.rows.sel, backdrop: string | null = null;
  // a board's page: ten rows between the heading and the footer, smaller type (Gaylord 2026-10-19: ten rows a page, scrolling)
  const DENSE = 10, denseTop = TV.heading[1] + 44 * u, denseStep = (TV.detail - 46 * u - denseTop) / (DENSE - 1), dense = Array.from({ length: DENSE }, (_, i) => denseTop + i * denseStep), denseS = Math.max(11, 22 * u);
  // a fifth row at the rows' own step: the five boards, WALLET and SYSTEM each fit one screen (Gaylord 2026-10-19)
  const five = () => { const step = baselines[1] - baselines[0], [x, y, w, h] = sel[sel.length - 1]; baselines = [...TV.rows.baselines, TV.rows.baselines[N - 1] + step]; sel = [...TV.rows.sel, [x, y + step, w, h]]; };
  const list = (n: number) => { total = n; at = Math.min(cur, Math.max(0, n - 1)); start = Math.min(Math.max(0, at - baselines.length + 1), Math.max(0, n - baselines.length)); selected = at; };
  const kv = (pairs: [string, string, (() => void)?][], valueFont: Font, valueColor: string) => {
    five(); list(pairs.length); if (pairs.length > baselines.length) count = `${pad2(at + 1)} / ${pad2(pairs.length)}`; // more rows than the TV shows: say where the cursor is
    rows = pairs.map(([k, v], i) => ({ key: k, cells: [cell(k, C["my-runs"].type, C["wallet-system"].keyS, "cp", i === at ? AMBER : CYAN), cell(v, C["wallet-system"].valueR, C["wallet-system"].valueS, valueFont, valueColor, true)] }));
    enter = pairs[at]?.[2] ?? null;
  };
  const stage = STATIONS[station], preview = previewOf(stage), tuning = mode === "solo" && !loaded.has(preview);
  // the dial's locks: what this wallet has posted opens the later tracks (unlock.ts); a locked stage shows, dark, with its price, and DRIVE stays dark
  const posted = notes.filter((n) => n.kind === "record" && same(me, n.storage.champion)).map((n) => n.storage.target);
  const lock = mode !== "solo" ? null : noBread && station > 0 ? ("bread" as const) : !unlocked(station, posted) ? need(station) : null;
  if (mode === "solo") {
    if (lock === "bread") { word = "get bread"; go = getBread; } else { word = "drive"; go = lock ? null : onDrive; }
    if (tuning) status = ["TUNING"];
  } else if (mode === "challenge") {
    heading = "CHALLENGE";
    if (review) {
      const r = review, mine = same(me, r.storage.champion), done = over(r);
      rev = { heading: done ? "RECORD OVER" : "CHALLENGE", label: `CHAMPION ${champion(r)}`, score: r.storage.target, line: mine ? "YOUR OWN RECORD" : "", song: songIn(r), left: done ? undefined : r.storage.expiryBlock - height };
      backdrop = previewOf(STATIONS[songIn(r)]);
      // SHOT: the Gamecoin in, the drive starts at once (Gaylord 2026-10-18: no PRESS DRIVE step, the shot window is six minutes)
      if (done) { word = "try another"; go = () => setReview(null); } // an over record (by link, mostly): the key leads to the open ones, like BACK (Gaylord 2026-10-21)
      else if (!mine) { word = "shot"; go = () => void chain?.shoot(r).then((x) => x && onShot(x.shots, x.record)); }
    } else if (loading || opening) status = ["LOADING"];
    else if (!records.length) status = ["NO CHALLENGES YET"];
    else {
      list(records.length); count = `${records.length} OPEN`;
      rows = records.map((n, i) => ({ key: n.id, cells: [cell(champion(n), C.challenge.champion, C.challenge.nicknameS, "cp", i === at ? AMBER : WHITE), cell(score(n.storage.target), C.challenge.scoreR, C.challenge.scoreS, "mono", AMBER, true), cell(songOf(songIn(n)), C.challenge.stage, C.challenge.stageS, "cp", i === at ? AMBER : WHITE, false, C.challenge.stageW)] }));
      const s = records[at];
      backdrop = previewOf(STATIONS[songIn(s)]); // the record's stage behind the list, dimmed (Gaylord 2026-10-19)
      footer = [cell(songOf(songIn(s)), TV.safe[0], TV.review.stageS, "cp", AMBER, false, undefined, TV.footer), cell("TIME LEFT", TV.count[0], Math.max(11, 14 * u), "cp", CYAN, true, undefined, TV.detail - 4 * u), cell(clock(s.storage.expiryBlock - height), TV.count[0], TV.review.expiryS, "mono", AMBER, true, undefined, TV.footer + 4 * u)];
      enter = () => setReview(s);
    }
  } else if (mode === "my-runs") {
    heading = "MY RUNS";
    const o = opened ? runs.find((r) => r.key === opened) : null;
    if (!me) { status = [noBread ? "NO BREAD WALLET" : chain?.connecting ? chain.walletStatus || "CONNECTING" : "CONNECT YOUR WALLET"]; if (noBread) { word = "get bread"; go = getBread; } else if (!chain?.connecting && chain?.installed) { word = "connect"; go = () => void chain.connect(); } }
    else if (o) {
      rev = { heading: o.word === "drive" ? "SHOT READY" : o.kind === "record" ? "MY RECORD" : "MY SHOT", label: o.label, score: o.score, line: o.word === "drive" ? "PRESS DRIVE" : o.line, tone: o.tone, song: o.song, left: o.deadline };
      backdrop = previewOf(STATIONS[o.song]);
      if (o.word === "collect") { word = "collect"; go = () => void chain?.collect(owed).then((ok) => ok && flash("COINS RECEIVED")); } // everything owed, one transaction
      else if (o.word === "drive") { word = "drive"; go = () => onShot(o.shots!, o.record!); }
    } else if (loading) status = ["LOADING"];
    else if (!runs.length) { status = ["NO RUNS YET", "A POST COSTS 1 GAMECOIN. GET SOME WITH THE RED KEY"]; word = "gamecoins"; go = openShop; }
    else {
      list(runs.length); count = `${runs.length} RUNS`;
      rows = runs.map((r, i) => ({ key: r.key, cells: [cell(r.kind.toUpperCase(), C["my-runs"].type, C["my-runs"].typeS, "cp", i === at ? AMBER : WHITE), cell(score(r.score), C["my-runs"].scoreR, C["my-runs"].scoreS, "mono", AMBER, true), cell(r.state, C["my-runs"].stateR, C["my-runs"].stateS, "cp", i === at ? AMBER : TONE[r.state] ?? WHITE, true)] }));
      const r = runs[at]; // the stage under the list (the rows have no room for it); the money or the rival on the right, unless the line only repeats the state
      backdrop = previewOf(STATIONS[r.song]); // and its painting behind the list, like CHALLENGE
      footer = [cell(songOf(r.song), TV.safe[0], TV.review.stageS, "cp", AMBER, false, undefined, TV.footer), ...(r.line === r.state ? [] : [cell(r.line, TV.count[0], 20 * u, "cp", CYAN, true, undefined, TV.footer)])];
      const k = runs[at].key; enter = () => setOpened(k);
    }
  } else if (mode === "leaderboards") {
    heading = "LEADERBOARDS";
    if (loading) status = ["LOADING"];
    else if (!board) { // the five boards as a list, how many players on each (BEST RECORDS: distinct champions, its page counts the records); ENTER opens one
      const players = (rows: { who: Parameters<typeof keyOf>[0] }[]) => new Set(rows.map((r) => keyOf(r.who))).size;
      five(); list(BOARDS.length);
      rows = BOARDS.map(([key, title], i) => ({ key, cells: [cell(title, C.leaderboards.name, C.challenge.nicknameS, "cp", i === at ? AMBER : key === "losers" ? PINK : WHITE), cell(`${players(best[key].top)} PLAYER${players(best[key].top) === 1 ? "" : "S"}`, C["wallet-system"].valueR, C.leaderboards.scoreS, "mono", AMBER, true)] }));
      const k = BOARDS[at][0]; enter = () => setBoard(k);
    } else { // one board, ten rows a page: PREV / NEXT turn the pages, BACK closes it. The number one opens every later page (nine more ranks under it, so none is skipped; Gaylord 2026-10-21)
      const title = BOARDS.find(([k]) => k === board)![1], b = best[board], pages: typeof b.top[] = [];
      for (let from = 0; from < b.top.length || !pages.length; ) { if (!from) { pages.push(b.top.slice(0, DENSE)); from += DENSE; } else { pages.push([b.top[0], ...b.top.slice(from, from + DENSE - 1)]); from += DENSE - 1; } }
      total = pages.length; at = Math.min(cur, total - 1); baselines = dense; if (total > 1) count = `${pad2(at + 1)} / ${pad2(total)}`;
      rows = pages[at].map((r) => ({ key: r.key, cells: board === "records" // a record's row says its track too, in the CHALLENGE columns (Gaylord 2026-10-21)
        ? [cell(`${pad2(r.rank)} ${chain?.nameOf(r.who) ?? "???"}`, C.challenge.champion, denseS, "cp", same(me, r.who) ? AMBER : WHITE), cell(score(r.value), C.challenge.scoreR, denseS, "mono", AMBER, true), cell(songOf(r.song!), C.challenge.stage, C.challenge.stageS, "cp", same(me, r.who) ? AMBER : WHITE, false, C.challenge.stageW)]
        : [cell(`${pad2(r.rank)} ${chain?.nameOf(r.who) ?? "???"}`, C.leaderboards.name, denseS, "cp", same(me, r.who) ? AMBER : WHITE), cell(String(r.value), C.leaderboards.scoreR, denseS, "mono", AMBER, true)] }));
      footer = [cell(title, TV.safe[0], 24 * u, "cp", board === "losers" ? PINK : CYAN, false, undefined, TV.detail), ...(rows.length ? [] : [cell("NO ONE YET", C.leaderboards.name, C.challenge.nicknameS, "cp", WHITE, false, undefined, TV.rows.baselines[0])])];
      if (me && !runs.length) { word = "gamecoins"; go = openShop; } // a newcomer's way onto the boards
    }
  } else if (mode === "wallet") {
    heading = "WALLET";
    const connect = noBread ? getBread : !me && chain?.installed && !chain.connecting ? () => void chain.connect() : undefined; // the red key and ENTER on STATUS, until connected
    const bestScore = Number(stored("pub.best") ?? 0), b = chain?.balance ?? null;
    // BALANCE carries the one thing to do with it: claim what is owed, or get more when down to 1 or less (Gaylord 2026-10-19)
    const balance: [string, string, (() => void)?] = b == null ? ["BALANCE", "ENTER TO READ", () => void chain?.readBalance()] // Bread asks the player on every asset read, so the row waits for ENTER (Gaylord 2026-10-21: a pop-up on arrival)
      : owed.length ? ["BALANCE", `${gc(b)}. ENTER TO CLAIM`, () => void chain?.collect(owed).then((ok) => { if (ok) { flash("COINS RECEIVED"); void chain.readBalance(); } })]
      : b <= STAKE ? ["BALANCE", `${gc(b)}. ENTER TO GET MORE`, openShop]
      : ["BALANCE", gc(b), () => void chain?.readBalance()];
    kv([
      ["STATUS", !chain?.installed ? "NO BREAD WALLET" : me ? "CONNECTED" : chain.connecting ? chain.walletStatus || "CONNECTING" : "NOT CONNECTED", connect],
      ...(me ? [["PLAYER", chain!.nameOf(me)], balance] as [string, string, (() => void)?][] : []),
      ["RESET BEST", bestScore ? score(bestScore) : "--", bestScore ? () => { store("pub.best", null); setNote("BEST SCORE CLEARED"); } : undefined],
      ...(me ? [["DISCONNECT", "ENTER", () => void chain?.disconnect()]] as [string, string, (() => void)?][] : []),
    ], "mono", AMBER);
    if (connect) { word = noBread ? "get bread" : "connect"; go = connect; }
  } else {
    heading = "SYSTEM";
    // the network monitor's word on what the game needs: reads, proving, and the node taking our transactions
    const NEEDED: [string, string][] = [["rpc", "RPC"], ["remote prover", "PROVER"], ["local transactions", "TRANSACTIONS"]];
    const down = health && NEEDED.find(([k]) => health[k] !== "healthy");
    const addr = chain?.address ?? null;
    kv([
      ["VERSION", __PUB_VERSION__],
      ["ADDRESS", addr ? `${addr.slice(0, 7)}…${addr.slice(-5)} COPY` : "--", addr ? () => void navigator.clipboard?.writeText(addr).then(() => setNote("ADDRESS COPIED"), () => setNote("COPY FAILED")) : undefined],
      ["NETWORK", MAINNET ? "MIDEN MAINNET" : "MIDEN TESTNET"],
      ["STATUS", !health ? "CHECKING" : !Object.keys(health).length ? "UNKNOWN" : down ? `${down[1]} DOWN` : "ALL GOOD", () => void window.open(STATUS_URL, "_blank", "noopener")],
      ["RPC", (chain?.rpc ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "") || "--"],
    ], "mono", AMBER); // the same face and colour as WALLET and every list value (Gaylord 2026-10-19)
  }
  // GET GAMECOINS over any mode (Gaylord 2026-10-23): a box with how many, PREV and NEXT step through QUANTITIES, the red key buys
  const qty = shop === null ? 0 : QUANTITIES[shop];
  if (shop !== null) {
    heading = "GET GAMECOINS"; rows = []; footer = []; count = ""; status = null; rev = null; backdrop = null; enter = null;
    total = QUANTITIES.length; at = shop;
    word = "buy"; go = () => void chain?.buy(BigInt(qty) * 10n ** BigInt(GC_DECIMALS)).then((m) => { if (m) { setShop(null); setNote(m); } });
  }
  // the chain's say comes over the mode's own screen: what is being done, where it is and how long it takes (flow.ts waiting), the trouble after, our own note
  if (busy) { const [what, how] = waiting(busy, chain?.local); status = [(busy.stage === "connect" && chain?.walletStatus) || what, `${busy.text}. ${how}`]; word = "wait"; go = null; rev = null; }
  // the raw error shows under the title (Gaylord 2026-10-18: "copy-paste the error and tag @zkGaylord on X"), capped so it stays on the TV
  else if (trouble) { const [head, tail] = headline(trouble.t.title); status = [head, [tail, trouble.t.detail ? `${cut(trouble.t.detail, 100).toUpperCase()} (COPY IT AND TAG @ZKGAYLORD ON X)` : ""].filter(Boolean).join("\n") || undefined]; rev = null; word = trouble.retry ? "try again" : null; go = trouble.retry ? () => { const r = trouble.retry!; chain?.dismiss(); r(); } : null; } // the red key itself says TRY AGAIN (Gaylord 2026-10-21)
  else if (note) { const [head, tail] = headline(note); status = [head, noteUntil ? `BACK TO THE TRACK IN ${Math.max(1, Math.ceil((noteUntil - Date.now()) / 1000))}` : tail || undefined]; rev = null; word = null; go = null; }
  else if (pop) {
    const shots = owed.filter((n) => n.kind === "shot").length, records = owed.length - shots;
    status = [`${gc(owed.reduce((sum, n) => sum + n.amount, 0n))} TO COLLECT`, [shots ? `${shots === 1 ? "A RIVAL" : "RIVALS"} TRIED TO BEAT YOU AND FAILED!` : "", records ? (shots ? `${records === 1 ? "A RECORD" : "RECORDS"} OF YOURS RAN OUT TOO.` : `YOUR RECORD${records === 1 ? "" : "S"} RAN OUT. YOUR GAMECOIN${records === 1 ? " IS" : "S ARE"} BACK.`) : ""].filter(Boolean).join("\n")];
    rev = null; word = "collect"; go = () => { setOwedPop(false); void chain?.collect(owed).then((ok) => ok && flash("COINS RECEIVED")); };
  }

  // which keys answer, by the pack's rules: a root has no BACK, ENTER opens rows only, the arrows stop at a list's ends
  // (the stages wrap), nothing but VOL and MUTE while the chain works
  const root = !review && !opened && !board && shop === null && !note && !trouble && !pop;
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
  const clearNote = () => { clearTimeout(noteTimer.current); setNoteUntil(null); setNote(null); };
  const goMode = (m: Mode) => { setMode(m); setReview(null); setOpened(null); setBoard(null); setShop(null); clearNote(); chain?.dismiss(); };
  /** a note for five seconds, then the track */
  const flash = (t: string) => { clearNote(); setNote(t); setNoteUntil(Date.now() + 5000); noteTimer.current = window.setTimeout(() => goMode("solo"), 5000); };
  const back = () => { if (trouble) return chain?.dismiss(); if (pop) return setOwedPop(false); if (note) return clearNote(); if (shop !== null) return setShop(null); if (review) return setReview(null); if (board) return setBoard(null); setOpened(null); };
  const stepTo = (d: number) => { if (shop !== null) return setShop((s) => Math.max(0, Math.min(QUANTITIES.length - 1, (s ?? 0) + d))); if (mode === "solo") return setStation((station + d + STATIONS.length) % STATIONS.length); if (total) setCursor({ ...cursor, [cursorKey]: Math.max(0, Math.min(total - 1, at + d)) }); };
  const act = (id: string, half?: 0 | 1) => {
    if (!on(id)) return;
    if (MODES.includes(id as Mode)) return goMode(id as Mode);
    switch (id) {
      case "prev": return stepTo(-1);
      case "next": return stepTo(1);
      case "back": return back();
      case "enter": return enter?.();
      case "action": if (swapping.current) return; return go?.();
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
  // MY RUNS blinks (once a second, on the clock tick) while coins wait there; steady under reduced motion (Gaylord 2026-10-19)
  const coinsWait = owed.length > 0 && (reduced() || Math.floor(Date.now() / 1000) % 2 === 0);
  const lit = (id: string) => id === mode || (id === "mute" && muted) || (id === "my-runs" && coinsWait);
  const face = (id: string) => (pressed === id ? (lit(id) ? "selected-pressed" : "pressed") : !on(id) ? "disabled" : lit(id) ? "selected" : hover === id ? "hover" : "rest");
  const box = (r: number[]) => ({ left: px(r[0]), top: px(r[1]), width: px(r[2]), height: px(r[3]) });
  /** Text on its baseline inside the TV */
  const text = (t: string, x: number, baseline: number, size: number, font: Font, color: string, right = false, key?: string | number, width?: number) => (
    <span key={key} className={`gp-text gp-${font}`} style={{ [right ? "right" : "left"]: px(right ? TV.size[0] - x : x), top: px(baseline - baselineEm(FAMILY[font]) * size * K[font]), fontSize: px(size * K[font]), color, maxWidth: width ? px(width) : undefined }}>{t}</span>
  );
  const cells = (cs: Cell[], baseline?: number) => cs.map((c, k) => text(c.t, c.x, c.y ?? baseline ?? 0, c.size, c.font, c.color, c.right, k, c.width));
  // the stage's conditions: district, light, weather, each an icon and a word, on a baseline
  const cond = (song: number, baseline: number) => {
    const st = STATIONS[song], items: [string, string][] = [["location", NAME[st.district]], [st.time, st.time.toUpperCase()], [st.rain ? "rain" : "clear", st.rain ? "RAIN" : "CLEAR"]];
    return TV.cond.map((c, k) => (
      <span key={k}>
        <img src={`${GP}icons/${items[k][0]}.png`} alt="" style={{ left: px(c.icon[0]), top: px(baseline - (c.text[1] - c.icon[1])), width: px(c.icon[2]), height: px(c.icon[3]) }} />
        {text(items[k][1], c.text[0], baseline, c.text[2], "cp", AMBER)}
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
          {backdrop && !status && loaded.has(backdrop) && <img className="gp-pic dim" style={{ filter: `brightness(${(DIM_TO / loaded.get(backdrop)!).toFixed(3)}) saturate(.8)` }} src={backdrop} alt="" />}
          {mode === "solo" && !status && (
            <>
              <img className={`gp-pic${lock ? " locked" : ""}`} src={preview} alt="" />
              <div className="gp-shade" />
              {lock && <svg className="gp-lock" viewBox="0 0 32 32" style={box([TV.size[0] / 2 - TV.size[1] * 0.14, TV.size[1] / 2 - TV.size[1] * 0.14, TV.size[1] * 0.28, TV.size[1] * 0.28])}><path d="M10 14v-4a6 6 0 0 1 12 0v4" /><rect x="6.5" y="14" width="19" height="13" rx="2" /><circle cx="16" cy="20.5" r="1.5" fill="currentColor" stroke="none" /></svg>}
              {brand(TV.scene.logo, "left")}
              {text(`${pad2(station + 1)} / ${pad2(STATIONS.length)}`, TV.count[0], TV.count[1], TV.count[2], "cp", AMBER, true)}
              {text(stage.title, TV.scene.title[0], TV.scene.title[1], TV.scene.title[2], "cp", WHITE)}
              {lock ? text(lock === "bread" ? "GET BREAD TO UNLOCK" : `LOCKED: POST ${lock.records} RECORD${lock.records > 1 ? "S" : ""}, ONE AT ${lock.score}+`, TV.cond[0].icon[0], TV.cond[0].text[1], TV.cond[0].text[2], "cp", PINK) : cond(station, TV.cond[0].text[1])}
            </>
          )}
          {mode !== "solo" && !status && !rev && shop === null && (
            <>
              {text(heading, TV.heading[0], TV.heading[1], TV.heading[2], "cp", AMBER)}
              {brand(TV.brand, "right")}
              {count && text(count, TV.count[0], TV.heading[1], TV.count[2], "mono", CYAN, true)}{/* on the heading line: the corner holds the brand here (it hid the count, 2026-10-19) */}
              {rows.slice(start, start + baselines.length).map((row, j) => {
                const i = start + j, r = sel[j];
                return (
                  <span key={row.key}>
                    {i === selected && r && <img src={`${GP}${layout}/row.png`} alt="" style={box(r)} />}
                    {i === selected && r && <img src={`${GP}icons/cursor.png`} alt="" style={{ left: px(r[0] + 5 * u), top: px(r[1] + r[3] / 2 - 6 * u), width: px(12 * u), height: px(12 * u) }} />}
                    {cells(row.cells, baselines[j])}
                  </span>
                );
              })}
              {cells(footer)}
            </>
          )}
          {shop !== null && !status && (
            <>
              {text(heading, TV.heading[0], TV.heading[1], TV.heading[2], "cp", AMBER)}
              {brand(TV.brand, "right")}
              {(() => { // the box in the middle of the tube: the number in it, a chevron each side (dark at the ends), the coin and the price under it
                const cx = TV.size[0] / 2, w = 300 * u, h = 120 * u, top = mid - 70 * u, chev = 150 * u + 40 * u;
                const arrow = (dir: -1 | 1, dim: boolean) => <svg key={dir} className={`gp-chev${dim ? " dim" : ""}`} viewBox="0 0 24 40" style={box([cx + dir * chev - 12 * u, top + h / 2 - 20 * u, 24 * u, 40 * u])}><path d={dir < 0 ? "M18 4 6 20l12 16" : "M6 4l12 16L6 36"} /></svg>;
                return (
                  <>
                    <svg className="gp-box" viewBox={`0 0 ${w} ${h}`} style={box([cx - w / 2, top, w, h])}><rect x="2" y="2" width={w - 4} height={h - 4} rx={6 * u} /></svg>
                    {arrow(-1, shop === 0)}
                    {arrow(1, shop === QUANTITIES.length - 1)}
                    <span className="gp-text gp-mono" style={{ left: px(cx - w / 2), width: px(w), textAlign: "center", top: px(top + h / 2 + 32 * u - baselineEm(FAMILY.mono) * 88 * u * K.mono), fontSize: px(88 * u * K.mono), color: AMBER }}>{qty}</span>
                    <span className="gp-text gp-cp" style={{ left: 0, width: px(TV.size[0]), textAlign: "center", top: px(top + h + 40 * u - baselineEm(FAMILY.cp) * 24 * u), fontSize: px(24 * u), color: CYAN }}>{qty === 1 ? "GAMECOIN" : "GAMECOINS"}</span>
                    <span className="gp-text gp-mono" style={{ left: 0, width: px(TV.size[0]), textAlign: "center", top: px(top + h + 78 * u - baselineEm(FAMILY.mono) * 26 * u * K.mono), fontSize: px(26 * u * K.mono), color: WHITE }}>{`FOR ${fmtPay(BigInt(qty) * GC_PRICE).toUpperCase()}`}</span>
                  </>
                );
              })()}
            </>
          )}
          {rev && !status && (
            <>
              {text(rev.heading, TV.heading[0], TV.heading[1], TV.heading[2], "cp", AMBER)}
              {brand(TV.brand, "right")}
              {text(rev.label, TV.review.champion[0], TV.review.champion[1], 24 * u, "cp", CYAN)}
              {text(score(rev.score), TV.review.score[0], TV.review.score[1], TV.review.scoreS, "mono", AMBER)}
              {rev.line && text(rev.line, TV.review.score[0], TV.review.score[1] + Math.min(66 * u, (TV.review.stage[1] - TV.review.score[1]) * 0.52), 28 * u, "cp", rev.tone === "pink" ? PINK : WHITE)} {/* on phones the stage sits 44 px under the score: the line halfway, not on the stage */}
              {text(songOf(rev.song), TV.review.stage[0], TV.review.stage[1], TV.review.stageS, "cp", WHITE)}
              {cond(rev.song, TV.review.conditions)}
              {rev.left !== undefined && text(`TIME LEFT ${clock(rev.left)}`, TV.review.expiry[0], TV.review.expiry[1], TV.review.expiryS, "mono", CYAN)}
            </>
          )}
          {status && (
            <>
              {brand(TV.brand, "right")}
              <div className="gp-status" style={{ left: px(TV.safe[0]), top: px(mid - baselineEm(FAMILY.cp) * TV.heading[2] * K.cp), width: px(TV.safe[2]) }}>{/* the heading wraps when it must (phones); the paragraph follows it */}
                <p className="gp-cp" style={{ fontSize: px(TV.heading[2] * K.cp), color: trouble && !trouble.retry ? PINK : AMBER }}>{status[0]}</p>
                {status[1] && <p className="gp-para gp-cp" style={{ marginTop: px(34 * u - (1 - baselineEm(FAMILY.cp)) * TV.heading[2] * K.cp), fontSize: px(20 * u), color: CYAN }}>{status[1]}</p>}
              </div>
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
        <span className="gp-text gp-lcd" style={{ left: px(R.purpose[0]), top: px(R.purpose[1] - baselineEm(LCD) * R.purpose[2] * K.lcd), fontSize: px(R.purpose[2] * K.lcd), color: AMBER }}>{shop !== null ? "PICK HOW MANY AND BUY" : pop ? "COLLECT YOUR GAMECOINS" : PURPOSE[mode]}</span>
        <Meter layout={layout} m={R.meter} />
        <img className="gp-plaque" src={`${GP}${layout}/plaque.png`} alt="electronic GRAND PRIX" style={box(R.plaque)} />
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
          {shown && <span key={shown} className={`gp-legend gp-lcd${phase ? ` ${phase}` : ""}${on("action") || phase === "out" ? "" : " dim"}`} style={{ ...cap, fontSize: px(action.rect[3] * 0.5 * K.lcd) }}>{shown.toUpperCase()}</span>}
          {phase === "in" && <img className="gp-glint" src={`${GP}${layout}/key/blank-hover.png`} alt="" style={cap} />}
          <button className="hit" aria-label={shown ? shown.toUpperCase() : "NO ACTION"} disabled={!on("action")} style={box([action.hit[0] - action.rect[0], action.hit[1] - action.rect[1], action.hit[2], action.hit[3]])} onClick={() => press("action")} onMouseUp={(e) => e.currentTarget.blur()} onMouseEnter={() => setHover("action")} onMouseLeave={() => setHover(null)} />
          <img className="gp-focus" src={`${GP}${layout}/key/focus.png`} alt="" style={cap} />
        </span>
      </div>
    </div>
  );
}
