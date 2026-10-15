import { useEffect, useRef, useState } from "react";
import { KMH, NAME, PLACE, RATE, RUN, TOP, agePoints, candidate, newSim, step, tick, type District, type Input, type Rider, type Sim } from "./game/sim";
import { CHARACTERS, extend } from "./game/course";
import { COLOR, draw } from "./game/render";
import { ICON, loadArt } from "./game/art";
import { MENU_TRACK, RESULTS_TRACK, STATIONS } from "./game/stations";
import { audio } from "./audio";

type Mode = "ready" | "radio" | "play" | "paused" | "over";
const STEP = 1 / 120;
const KEYS: Record<string, keyof Input> = { ArrowUp: "gas", w: "gas", ArrowDown: "brake", s: "brake", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
const ART = `${import.meta.env.BASE_URL}art/`;
const PORTRAITS: Record<string, string> = { a: "portraits.webp", b: "portraits-b.webp", c: "portraits-c.webp" };
const fmt = (n: number) => n.toLocaleString("en-US");
const face = (r: Rider) => {
  const ch = CHARACTERS[r.id];
  return `<i class="face" style="background-image:url(${ART}${PORTRAITS[ch.atlasSet ?? "a"]});background-position:${(ch.atlasIndex % 4) * 100 / 3}% ${Math.floor(ch.atlasIndex / 4) * 100 / 3}%"></i>`;
};
const icon = (d: District) => `<img class="icon" src="${ART}${ICON[d]}" alt="${PLACE[d]}">`;
const best = () => Number(localStorage.getItem("pub.best") ?? 0);

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const sim = useRef<Sim>(newSim(1));
  const input = useRef<Input>({ gas: false, brake: false, left: false, right: false });
  const [mode, setMode] = useState<Mode>("ready");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const loadedRef = useRef(false);
  const [seed, setSeed] = useState(1);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { loadArt().then(() => { loadedRef.current = true; setLoaded(true); }, (e) => console.error(e)); }, []);
  const [station, setStation] = useState(0);
  const stationRef = useRef(0);
  stationRef.current = station;
  const [preview, setPreview] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  // music follows the screen: menus loop Boomers, the run plays the station from its first second, results loop Wireline Cosmos
  useEffect(() => {
    if (mode === "radio") { if (preview) audio.run(STATIONS[station].id); else audio.menu(MENU_TRACK); }
    else if (mode === "play") { if (sim.current.t === 0) audio.run(STATIONS[station].id); else audio.resume(); }
    else if (mode === "paused") audio.pause();
    else if (mode === "over") audio.results(RESULTS_TRACK);
    if (mode !== "play") { audio.engine(0, false); audio.skid(false); }
  }, [mode, preview, station]);

  const start = (sd: number) => { setPreview(false); sim.current = newSim(sd); setSeed(sd); setMode("play"); };
  // dev hook: drive the sim from the console (window.pub.run({gas:true}, 5))
  if (import.meta.env.DEV) Object.assign(window, { pub: { sim, run: (inp: Partial<Input>, secs: number) => { for (let t = 0; t < secs; t += STEP) step(sim.current, { gas: false, brake: false, left: false, right: false, ...inp }, STEP, extend); } } });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "m") setSoundOn(audio.toggle());
      if (modeRef.current === "radio") {
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") setStation((i) => (i + STATIONS.length - 1) % STATIONS.length);
        if (e.key === "ArrowDown" || e.key === "ArrowRight") setStation((i) => (i + 1) % STATIONS.length);
        if (e.key === "Enter") { setPreview(false); sim.current = newSim(sim.current.seed); setMode("play"); }
        e.preventDefault();
        return;
      }
      const k = KEYS[e.key];
      if (k) { input.current[k] = true; e.preventDefault(); }
      if (e.key === "p" || e.key === "Escape") setMode((m) => (m === "play" ? "paused" : m === "paused" ? "play" : m));
      if (e.key === "Enter") { if (modeRef.current === "ready" && loadedRef.current) audio.unlock(); setMode((m) => (m === "paused" ? "play" : m === "ready" && loadedRef.current ? "radio" : m)); }
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.key]; if (k) input.current[k] = false; };
    const blur = () => { input.current = { gas: false, brake: false, left: false, right: false }; setMode((m) => (m === "play" ? "paused" : m)); };
    addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", blur);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), acc = 0, seen: Sim | null = null, logged = 0, lastCallout: Sim["callout"] = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      if (seen !== s) { seen = s; logged = 0; lastCallout = null; }
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      const playing = modeRef.current === "play";
      if (playing) {
        while (acc >= STEP) { step(s, input.current, STEP, extend); acc -= STEP; }
        if (s.over) { if (s.score > best()) localStorage.setItem("pub.best", String(s.score)); setMode("over"); }
        for (; logged < s.log.length; logged++) { const e = s.log[logged]; if (e.k === "pick") audio.sfx("pick"); else if (e.k === "drop") audio.sfx("drop"); else if (e.k === "wreck") audio.sfx("crash"); }
        if (s.callout && s.callout !== lastCallout && /BUMP|SPIN/.test(s.callout.text)) audio.sfx("thud");
        lastCallout = s.callout;
        audio.engine(Math.abs(s.v) / TOP, input.current.gas); audio.skid(s.skid);
        audio.fade(Math.min(1, (RUN - s.t) / 3)); // the song ends with the clock
      } else acc = 0;
      const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (s.streets.length === 0) extend(s);
      draw(ctx, s, w, h);
      const el = hud.current!;
      const set = (id: string, text: string) => { const n = el.querySelector<HTMLElement>(`#${id}`)!; if (n.textContent !== text) n.textContent = text; };
      const html = (id: string, markup: string) => { const n = el.querySelector<HTMLElement>(`#${id}`)!; if (n.dataset.k !== markup) { n.dataset.k = markup; n.innerHTML = markup; } };
      const left = Math.ceil(RUN - s.t);
      set("time", `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      el.querySelector<HTMLElement>("#time")!.classList.toggle("late", left <= 20);
      set("score", String(s.score).padStart(5, "0"));
      set("speed", String(Math.round(s.v * KMH)).padStart(3, "0"));
      const full = !s.seats.includes(null);
      set("bank", `TO BANK ${fmt(s.seats.reduce((a, r) => a + (r ? agePoints(r.age) : 0), 0))}${full ? "  FULL" : ""}`);
      s.seats.forEach((r, i) => html(`seat${i}`, r ? `${face(r)}${icon(r.dest)}<small>AGE</small><b>${r.age}</b><em>${fmt(agePoints(r.age))}<small>PTS</small></em>` : `<span>EMPTY</span>`));
      // radar: the next stop's face and honest range; the reveal for 2 s after boarding; nothing at a fork
      const c = candidate(s), e = s.log[s.log.length - 1];
      const f = s.forks.find((o) => o.side === 0 && o.z - 400 < s.z && s.z < o.zDecide);
      const cur = s.streets[s.streets.length - 1];
      const just = e?.k === "pick" && tick(s) - e.t < 200 ? s.stops.find((o) => o.taken && o.i === e.stop && o.z >= cur.z0 && o.z < cur.z1)?.rider : undefined;
      html("radar", just ? `${face(just)}<div><b>AGE ${just.age}</b><br>${fmt(agePoints(just.age))} TO BANK</div>${icon(just.dest)}`
        : f ? "" : c?.rider ? `${face(c.rider)}<div>${full ? "<b>CAR FULL</b>" : `<b>${c.rider.lo}-${c.rider.hi}</b><br>${c.rider.cls}`}<br><small>TARGET 70-80</small></div>${icon(c.rider.dest)}`
        : c?.drop ? `<div><b>DROP OFF</b><br>${PLACE[c.drop]}</div>${icon(c.drop)}` : `<div>SEARCHING<br><small>TARGET 70-80</small></div>`);
      el.querySelector<HTMLElement>("#radar")!.parentElement!.style.display = f ? "none" : "";
      const badge = (d: District) => { const n = s.seats.filter((r) => r && r.dest === d).length; return n ? ` x${n}` : ""; };
      html("fork", f ? `<span style="color:${COLOR[f.left]}">&lt; ${NAME[f.left]}${badge(f.left)}</span><span style="color:${COLOR[f.right]}">${NAME[f.right]}${badge(f.right)} &gt;</span>` : "");
      const text = s.callout?.text ?? "";
      set("callout", text);
      el.querySelector<HTMLElement>("#callout")!.style.color = /WRECK|SPIN|BAILED/.test(text) ? "#ff40bd" : /CRAZY/.test(text) ? "#78ffcb" : /^\+|GROUP/.test(text) ? "#ffe564" : "#fff3f4";
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
      <div className="app">
      <canvas ref={canvas} />
      <div className="hud" ref={hud}>
        <div className="panel tl"><small>TIME</small><b id="time" /></div>
        <div className="panel tr"><small>SCORE</small><b id="score" /></div>
        <div className="panel bl"><small>SPEED</small><b id="speed" /><small>KM/H</small></div>
        <div className="rail">
          <div className="panel seats"><div id="bank" /><div className="slots"><div id="seat0" /><div id="seat1" /><div id="seat2" /></div></div>
          <div className="panel radar"><small>BOOMER RADAR</small><div id="radar" /></div>
        </div>
        <div className="fork" id="fork" />
        <div className="callout" id="callout" />
      </div>
      {mode === "ready" && (
        <div className="overlay splash" onClick={() => { if (loaded) { audio.unlock(); setMode("radio"); } }}><div className="start-prompt" data-text={loaded ? "CLICK TO START" : "LOADING"}><span className="face" data-text={loaded ? "CLICK TO START" : "LOADING"}>{loaded ? "CLICK TO START" : "LOADING"}</span></div></div>
      )}
      {mode === "radio" && (
        <div className="overlay radio">
          <h1>RADIO SELECT</h1>
          <div className="stations">
            {STATIONS.map((st, i) => <button key={st.id} className={i === station ? "on" : ""} onClick={() => setStation(i)}><span>{String(i + 1).padStart(2, "0")}</span><b>{st.title}</b><small>{st.mood}</small></button>)}
          </div>
          <p className="actions">
            <button className="cyan" onClick={() => setPreview((p) => !p)}>{preview ? "STOP" : "PREVIEW"}</button>
            <button className="cyan" onClick={() => setSoundOn(audio.toggle())}>{soundOn ? "SOUND ON" : "SOUND OFF"}</button>
            <button className="pink" onClick={() => start(seed)}>DRIVE</button>
          </p>
        </div>
      )}
      {mode === "paused" && <div className="overlay" onClick={() => setMode("play")}><h1>PAUSED</h1><p>CLOCK STOPPED</p></div>}
      {mode === "over" && (
        <div className="overlay results">
          <h1>TIME IS UP</h1>
          <p className="big">{String(s.score).padStart(5, "0")}</p>
          <p className="best">BEST {fmt(Math.max(best(), s.score))}</p>
          <div className="box cyan">
            <div><span>RIDERS DELIVERED</span><b>{s.delivered}</b></div>
            <div><span>DELIVERY POINTS</span><b>{fmt(s.banked)}</b></div>
            <div><span>DISTANCE</span><b>{fmt(Math.floor(s.dist * RATE))}</b></div>
          </div>
          <div className="box pink">
            <div><span>STILL ON BOARD</span><b>{s.lost.length ? `LOST ${fmt(s.lost.reduce((a, r) => a + agePoints(r.age), 0))}` : "NO RIDERS LEFT"}</b></div>
            {s.lost.map((r, i) => <div key={i} className="rider"><span dangerouslySetInnerHTML={{ __html: face(r) + icon(r.dest) }} /><span>{r.name} / AGE {r.age}</span><b>{fmt(agePoints(r.age))} LOST</b></div>)}
          </div>
          <p className="actions"><button className="cyan" onClick={() => start(seed)}>SAME RUN</button><button className="pink" onClick={() => { sim.current = newSim(seed + 1); setSeed(seed + 1); setMode("radio"); }}>NEW RUN</button></p>
        </div>
      )}
      </div>
      <div className="pad">
        <button {...hold("left")}>LEFT</button>
        <button {...hold("right")}>RIGHT</button>
        <button {...hold("brake")}>BRAKE</button>
        <button {...hold("gas")}>GAS</button>
      </div>
    </>
  );
}
