import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { KMH, NAME, PLACE, RUN, TOP, agePoints, candidate, newSim, step, tick, type District, type Input, type Rider, type Sim } from "./game/sim";
import { CHARACTERS, extend } from "./game/course";
import { COLOR, draw, setBeat, setSong } from "./game/render";
import { ART, ICON, PORTRAITS, loadArt, loadLight, loadLook } from "./game/art";
import { MENU_TRACK, RESULTS_TRACK, STATIONS } from "./game/stations";
import { audio, level, sound as soundNow, volume as volumeNow } from "./audio";
import HeadUnit from "./HeadUnit";
import { startAttract } from "./attract";
import { fmt, store, stored } from "./board";
import Loading from "./Loading";
import Results from "./Results";
import type { ChainApi, ChallengeNote, Posted } from "./chain/ChainHost";
import type { Settled } from "./chain/useChain";

// the chain (Miden SDK, Bread) loads beside the game: its wasm must never hold the splash
const ChainHost = lazy(() => import("./chain/ChainHost"));
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** A shot being driven: the shot notes on the table and the record they are at. */
type Shot = { shots: ChallengeNote[]; record: ChallengeNote };

type Mode = "ready" | "menu" | "play" | "paused" | "over";
const STEP = 1 / 120;
const KEYS: Record<string, keyof Input> = { ArrowUp: "gas", w: "gas", ArrowDown: "brake", s: "brake", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
const face = (r: Rider) => {
  const ch = CHARACTERS[r.id];
  return `<i class="face" style="background-image:url(${ART}${PORTRAITS[ch.atlasSet ?? "a"]});background-position:${(ch.atlasIndex % 4) * 100 / 3}% ${Math.floor(ch.atlasIndex / 4) * 100 / 3}%"></i>`;
};
const icon = (d: District) => `<img class="icon" src="${ART}${ICON[d]}" alt="${PLACE[d]}">`;
// the radar's portrait (visual update): the face downsampled to 48 samples, mapped to phosphor green and black with a
// 4 x 4 ordered dither, so a rider is a silhouette with a hint of hair and beard, never a recognisable face. Once per rider.
const DITHERED = new Map<string, string>();
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dithered(r: Rider): string {
  const hit = DITHERED.get(r.id);
  if (hit) return hit;
  const ch = CHARACTERS[r.id], im = new Image();
  im.src = `${ART}${PORTRAITS[ch.atlasSet ?? "a"]}`;
  if (!im.complete || !im.naturalWidth) return ""; // the atlas is in the browser cache from the seats; a miss just waits a frame
  const N = 48, cw = im.naturalWidth / 4, c = document.createElement("canvas"), g = c.getContext("2d")!;
  c.width = c.height = N;
  g.drawImage(im, (ch.atlasIndex % 4) * cw, Math.floor(ch.atlasIndex / 4) * cw, cw, cw, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N), q = d.data;
  for (let i = 0, p = 0; i < q.length; i += 4, p++) {
    // luminance as painted (sRGB): the portraits are dark, the linear reading left them almost all black
    const lum = (0.2126 * q[i] + 0.7152 * q[i + 1] + 0.0722 * q[i + 2]) / 255;
    const v = (lum - 0.13) / (0.7 - 0.13) + ((BAYER[(p % N % 4) + 4 * (Math.floor(p / N) % 4)] + 0.5) / 16 - 0.5) * 0.45;
    const on = v > 0.5;
    q[i] = on ? 0x85 : 0x03; q[i + 1] = on ? 0xe6 : 0x10; q[i + 2] = on ? 0x4b : 0x09; q[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const url = c.toDataURL();
  DITHERED.set(r.id, url);
  return url;
}
const best = () => Number(stored("pub.best") ?? 0);

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const attract = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>(newSim(1));
  const input = useRef<Input>({ gas: false, brake: false, left: false, right: false });
  const [mode, setMode] = useState<Mode>("ready");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const loadedRef = useRef(false);
  const [seed, setSeed] = useState(randomSeed);
  const [loaded, setLoaded] = useState(false);
  const [chain, setChain] = useState<ChainApi | null>(null);
  // posting the run just driven, on the results screen, then the record's share links
  const [posted, setPosted] = useState<Posted | null>(null);
  const shot = useRef<Shot | null>(null); // the run on the road is a shot at a record
  const settling = useRef(false);
  const botRun = useRef(false); // driven from the dev hook: never a best
  const [settled, setSettled] = useState<Settled | null>(null);
  const [openRecord, setOpenRecord] = useState<ChallengeNote | null>(null);
  const sharedId = useRef(new URLSearchParams(location.search).get("record"));
  const [progress, setProgress] = useState(0);
  useEffect(() => { loadArt((d, t) => setProgress(d / t)).then(() => { loadedRef.current = true; setLoaded(true); }, (e) => console.error(e)); }, []);
  useEffect(() => { if (mode === "ready" && loaded && attract.current) return startAttract(attract.current); }, [mode, loaded]);
  const [station, setStation] = useState(0);
  const stationRef = useRef(0);
  stationRef.current = station;
  const [soundOn, setSoundOn] = useState(soundNow);
  const [volume, setVolumeState] = useState(volumeNow);
  const setVolume = (v: number) => { audio.volume(v); setVolumeState(v); };
  // a record opened by link: the head unit starts on its review once the chain can read it
  useEffect(() => {
    const id = sharedId.current;
    if (!id || !chain?.ready) return;
    sharedId.current = null;
    void chain.loadRecord(id).then((r) => r && setOpenRecord(r));
  }, [chain]);
  // music follows the screen: menus loop Omotesando, the run plays the station from its first second, results loop Wireline Cosmos
  useEffect(() => {
    if (mode === "ready" || mode === "menu") audio.menu(MENU_TRACK); // silent until the browser allows sound; the song starts with the run
    else if (mode === "play") audio.resume(); // the run's song starts in start(), with the sim
    else if (mode === "paused") audio.pause();
    else if (mode === "over") audio.results(RESULTS_TRACK);
    if (mode !== "play") { audio.engine(0, false); audio.skid(false); }
  }, [mode, station]);

  // the stage's light (its skylines, venues, portals, frontage, water) and the song's look (its lamps, props, sky pieces) are fetched first; a miss logs and the run still starts.
  // The renderer and the music learn the song here, with the sim: the play effect ran after the first frame had stepped the sim on some runs and skipped both (a silver car under the default sky, the menu track still playing)
  const start = (sd: number, song: number) => void Promise.all([loadLight(STATIONS[song].time), loadLook(STATIONS[song])]).catch((e: unknown) => console.error(e)).then(() => {
    settling.current = false; setSettled(null); setPosted(null); botRun.current = false; sim.current = newSim(sd, song); setSong(STATIONS[song].id); audio.run(STATIONS[song].id); setSeed(sd); setMode("play");
  });
  /** A free drive on the station's song. */
  const drive = (sd: number) => { shot.current = null; start(sd, station); };
  /** A shot: the record's course and song, the stake on the table. */
  const driveShot = (shots: ChallengeNote[], record: ChallengeNote) => {
    shot.current = { shots, record };
    const song = Number(record.storage.game[4]);
    setStation(song);
    start(Number(record.storage.game[0]), song);
  };
  const toMenu = () => setMode("menu");
  // the run just driven: a shot settles itself
  useEffect(() => {
    if (mode !== "over") return;
    const s = sim.current, at = shot.current;
    if (!at || settled || !chain || settling.current) return; // chain is a new object on every chain state change: settle once
    settling.current = true;
    void chain.settle(at.shots, at.record, s.seed, s.song, s.log, s.dist, s.score).then((r) => { settling.current = false; if (r) setSettled(r); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chain]);
  const onOpened = useCallback(() => setOpenRecord(null), []);
  // dev hook: drive the sim from the console (window.pub.run({gas:true}, 5))
  if (import.meta.env.DEV) Object.assign(window, { pub: { sim, level, run: (inp: Partial<Input>, secs: number) => { botRun.current = true; for (let t = 0; t < secs; t += STEP) step(sim.current, { gas: false, brake: false, left: false, right: false, ...inp }, STEP, extend); } } });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (modeRef.current === "menu") return; // the head unit has its own keys
      if (e.key === "m") setSoundOn(audio.toggle());
      const k = KEYS[e.key];
      if (k) { input.current[k] = true; e.preventDefault(); }
      if (e.key === "p" || e.key === "Escape") setMode((m) => (m === "play" ? "paused" : m === "paused" ? "play" : m));
      if (e.key === "Enter") { if (modeRef.current === "ready" && loadedRef.current) audio.unlock(); setMode((m) => (m === "paused" ? "play" : m === "ready" && loadedRef.current ? "menu" : m)); }
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.key]; if (k) input.current[k] = false; };
    const blur = () => { input.current = { gas: false, brake: false, left: false, right: false }; setMode((m) => (m === "play" ? "paused" : m)); };
    addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", blur);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), acc = 0, seen: Sim | null = null, logged = 0, lastCallout: Sim["callout"] = null;
    const nodes = new Map<string, HTMLElement>();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      if (seen !== s) { seen = s; logged = 0; lastCallout = null; }
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      const playing = modeRef.current === "play";
      if (playing) {
        while (acc >= STEP) { step(s, input.current, STEP, extend); acc -= STEP; }
        if (s.over) { if (s.score > best() && !botRun.current) store("pub.best", String(s.score)); setMode("over"); }
        for (; logged < s.log.length; logged++) { const e = s.log[logged]; if (e.k === "pick") audio.sfx("pick"); else if (e.k === "drop") audio.sfx("drop"); else if (e.k === "wreck") audio.sfx("crash"); }
        if (s.callout && s.callout !== lastCallout && /BUMP|SPIN/.test(s.callout.text)) audio.sfx("thud");
        lastCallout = s.callout;
        audio.engine(Math.abs(s.v) / TOP, input.current.gas); audio.skid(s.skid);
        audio.fade(Math.min(1, (RUN - s.t) / 3)); // the song ends with the clock
      } else acc = 0;
      const dpr = Math.min(1.5, devicePixelRatio), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); // whole pixels: a half pixel never matched and WebKit rebuilt the canvas every frame (0.1x on an iPhone)
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (s.streets.length === 0) extend(s);
      setBeat(audio.levels()[0]);
      draw(ctx, s, w, h);
      const el = hud.current!;
      const node = (id: string) => nodes.get(id) ?? (nodes.set(id, el.querySelector<HTMLElement>(`#${id}`)!), nodes.get(id)!);
      const set = (id: string, text: string) => { const n = node(id); if (n.textContent !== text) n.textContent = text; };
      const html = (id: string, markup: string) => { const n = node(id); if (n.dataset.k !== markup) { n.dataset.k = markup; n.innerHTML = markup; } };
      const left = Math.ceil(RUN - s.t);
      set("time", `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      node("time").classList.toggle("late", left <= 20);
      set("score", fmt(s.score));
      set("speed", String(Math.round(s.v * KMH)).padStart(3, "0"));
      const full = !s.seats.includes(null);
      html("bank", `<span>BOOMER METER</span>${full ? "<em>FULL</em>" : ""}<span class="num">${fmt(s.seats.reduce((a, r) => a + (r ? agePoints(r.age) : 0), 0))}</span>`); // the name left, the points right, like SCORE
      s.seats.forEach((r, i) => html(`seat${i}`, r ? `${face(r)}${icon(r.dest)}<small>AGE</small><b>${r.age}</b><em>${fmt(agePoints(r.age))}<small>PTS</small></em>` : `<span>EMPTY</span>`));
      // radar: the next stop's face and honest range; the reveal for 2 s after boarding; scanning when there is no stop
      // ahead (it used to go dark 400 m before a fork, which hid the street's last stops; Gaylord: always on)
      const c = candidate(s), e = s.log[s.log.length - 1];
      const f = s.forks.find((o) => o.side === 0 && o.z - 400 < s.z && s.z < o.zDecide);
      const cur = s.streets[s.streets.length - 1];
      const just = e?.k === "pick" && tick(s) - e.t < 200 ? s.stops.find((o) => o.taken && o.i === e.stop && o.z >= cur.z0 && o.z < cur.z1)?.rider : undefined;
      // the radar's POSITION map: the blip sits on the curb's side and climbs with the distance (centre = here, top = 250 m out)
      const blip = (st: { z: number; side: number }) => `<i class="blip" style="left:${73.5 + st.side * 6.75}%;top:${38.4 - 21.8 * Math.min(1, Math.max(0, (st.z - s.z) / 250))}%"></i>`;
      // in a tunnel the radar scans: the next street's stop is not a target yet
      const bore = s.forks.find((o) => s.z >= o.mouth && s.z < o.zEnd + 100), tunnel = !!bore;
      // in the bore the next street's drop-off bay is 30 m past the tunnel's end: a rider aboard who wants that district is told how far
      const dest = bore ? (bore.side < 0 ? bore.left : bore.right) : null, ahead = bore && s.stops.find((o) => o.drop && o.z > s.z);
      const warn = bore && dest && s.seats.some((r) => r && r.dest === dest) ? { dest, m: Math.max(0, Math.round(((ahead?.z ?? bore.zEnd + 130) - s.z) / 10) * 10) } : null;
      const radar = node("radar").parentElement!;
      radar.className = `radar-box ${just ? "" : tunnel ? (warn ? "" : "search") : c?.rider && full ? "full" : c?.rider || c?.drop ? "" : "search"}`;
      html("radar", just ? `${face(just)}<div class="reveal"><b>AGE ${just.age}</b><br>+${fmt(agePoints(just.age))} ON THE METER</div>${icon(just.dest)}`
        : tunnel ? (warn ? `<b class="range warn">DROP OFF<br>IN ${warn.m} M</b>${icon(warn.dest)}` : "") : c?.rider ? (full ? "" : `<img class="dither" src="${dithered(c.rider)}" alt=""><small class="pos">POSITION</small><img class="reticle" src="${ART}radar/reticle-B.png" alt="">${blip(c)}<small class="lab">AGE RANGE</small><b class="range">${c.rider.lo} TO ${c.rider.hi}</b>`)
        : c?.drop ? `<small class="pos">POSITION</small><img class="reticle" src="${ART}radar/reticle-B.png" alt="">${blip(c)}<b class="range drop">DROP OFF</b>${icon(c.drop)}` : "");
      // the fork cue, 400 m out to the decision line: the side a rider aboard wants blinks with the count, the other side dims
      const side = (d: District, left: boolean) => { const n = s.seats.filter((r) => r && r.dest === d).length; return `<span class="${n ? "want" : "pass"}" style="color:${COLOR[d]}">${left ? `&lt;&lt; ${NAME[d]}` : `${NAME[d]} &gt;&gt;`}${n ? `<b>DROP OFF x${n}</b>` : ""}</span>`; };
      html("fork", f ? side(f.left, true) + side(f.right, false) : "");
      const text = s.callout?.text ?? "";
      html("callout", text.replace(/\+(\d+)|X(\d[\d.]*)|AGE (\d+)/g, (_, award, mult, age) => award ? `<span class="num">+${fmt(Number(award))}</span>` : mult ? `<span class="num">x${mult}</span>` : `AGE <span class="num">${age}</span>`));
      node("callout").classList.toggle("high", /DROP OFF/.test(text));
      node("callout").style.color = /WRECK|SPIN|BAILED/.test(text) ? "#ff40bd" : /CRAZY/.test(text) ? "#78ffcb" : /^\+|GROUP/.test(text) ? "#ffe564" : /DROP OFF/.test(text) && dest ? COLOR[dest] : "#fff3f4";
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; },
    onPointerCancel: () => { input.current[k] = false; },
  });
  const s = sim.current;

  return (
    <>
      <div className={`app${mode === "over" ? " over" : ""}`}>
      <canvas ref={canvas} />
      <div className="hud" ref={hud}>
        <div className="panel tl"><small>TIME</small><b id="time" /></div>
        <div className="panel tr"><small>SCORE</small><b id="score" /></div>
        <div className="panel bl"><small>SPEED</small><b id="speed" /><small>KM/H</small></div>
        <div className="rail">
          <div className="panel"><div id="bank" /><div className="slots"><div id="seat0" /><div id="seat1" /><div id="seat2" /></div></div>
          <div className="radar-box"><div id="radar" /></div>
        </div>
        <div className="fork" id="fork" />
        <div className="callout" id="callout" />
      </div>
      {mode === "ready" && (
        <div className="overlay splash" onClick={() => { if (loaded) { audio.unlock(); setMode("menu"); } }}>
          <canvas className="attract" ref={attract} />
          {loaded ? <div className="start-prompt" data-text="CLICK TO START"><span className="glyphs" data-text="CLICK TO START">CLICK TO START</span></div> : <Loading progress={progress} />}
          <button className="splash-mute" onClick={(e) => { e.stopPropagation(); audio.unlock(); setSoundOn(audio.toggle()); }}>{soundOn ? "SOUND ON" : "MUTED"}</button>
        </div>
      )}
      {mode === "menu" && (
        <div className="overlay menu">
          <HeadUnit chain={chain} station={station} setStation={setStation} volume={volume} setVolume={setVolume} muted={!soundOn} toggleMute={() => setSoundOn(audio.toggle())}
            onDrive={() => drive(seed)} onShot={driveShot} onOff={() => setMode("ready")} openRecord={openRecord} onOpened={onOpened} />
        </div>
      )}
      {mode === "paused" && <div className="overlay dim" onClick={() => setMode("play")}><img className="pause" src={`${ART}pause.png`} alt="PAUSED. CLOCK STOPPED, CLICK TO RESUME" /></div>}
      {mode === "over" && (
        <div className="overlay dim screen">
          <Results s={s} station={station} chain={chain} posted={posted} setPosted={setPosted} shot={shot.current ? { target: shot.current.record.storage.target } : null} settled={settled}
            onSame={() => start(seed, station)} onNew={() => { setSeed(randomSeed()); toMenu(); }}
            onMenu={() => { chain?.dismiss(); shot.current = null; setSeed(randomSeed()); toMenu(); }} onRetry={(r) => { chain?.dismiss(); setSettled(null); r(); }} />
        </div>
      )}
      </div>
      <Suspense fallback={null}><ChainHost onApi={setChain} autoConnect={mode !== "ready"} /></Suspense>
      <div className="pad">
        <button {...hold("left")}>LEFT</button>
        <button {...hold("right")}>RIGHT</button>
        <button {...hold("brake")}>BRAKE</button>
        <button {...hold("gas")}>GAS</button>
      </div>
    </>
  );
}
