import { useEffect, useRef, useState } from "react";
import { KMH, NAME, PLACE, RATE, RUN, agePoints, candidate, newSim, step, type Input, type Sim } from "./game/sim";
import { extend } from "./game/course";
import { COLOR, draw } from "./game/render";
import { loadArt } from "./game/art";

type Mode = "ready" | "play" | "paused" | "over";
const STEP = 1 / 120;
const KEYS: Record<string, keyof Input> = { ArrowUp: "gas", w: "gas", ArrowDown: "brake", s: "brake", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };

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

  const start = (sd: number) => { sim.current = newSim(sd); setSeed(sd); setMode("play"); };
  // dev hook: drive the sim from the console (window.pub.run({gas:true}, 5))
  if (import.meta.env.DEV) Object.assign(window, { pub: { sim, run: (inp: Partial<Input>, secs: number) => { for (let t = 0; t < secs; t += STEP) step(sim.current, { gas: false, brake: false, left: false, right: false, ...inp }, STEP, extend); } } });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      if (k) { input.current[k] = true; e.preventDefault(); }
      if (e.key === "p" || e.key === "Escape") setMode((m) => (m === "play" ? "paused" : m === "paused" ? "play" : m));
      if (e.key === "Enter") setMode((m) => (m === "paused" ? "play" : m === "ready" && loadedRef.current ? "play" : m));
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.key]; if (k) input.current[k] = false; };
    const blur = () => { input.current = { gas: false, brake: false, left: false, right: false }; setMode((m) => (m === "play" ? "paused" : m)); };
    addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", blur);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      if (modeRef.current === "play") {
        while (acc >= STEP) { step(s, input.current, STEP, extend); acc -= STEP; }
        if (s.over) setMode("over");
      } else acc = 0;
      const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (s.streets.length === 0) extend(s);
      draw(ctx, s, w, h);
      const el = hud.current!;
      const set = (id: string, text: string) => { const n = el.querySelector<HTMLElement>(`#${id}`)!; if (n.textContent !== text) n.textContent = text; };
      const left = Math.ceil(RUN - s.t);
      set("time", `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      set("score", String(s.score).padStart(5, "0"));
      set("speed", String(Math.round(s.v * KMH)).padStart(3, "0"));
      set("bank", s.seats.some(Boolean) ? `TO BANK ${s.seats.reduce((a, r) => a + (r ? agePoints(r.age) : 0), 0)}` : "");
      s.seats.forEach((r, i) => {
        set(`seat${i}`, r ? `${r.name} ${r.age} > ${PLACE[r.dest]}` : "EMPTY");
        el.querySelector<HTMLElement>(`#seat${i}`)!.style.borderColor = r ? COLOR[r.dest] : "#555";
      });
      const c = candidate(s), full = !s.seats.includes(null);
      set("radar", c?.rider ? (full ? `CAR FULL` : `${c.rider.name}  ${c.rider.lo}-${c.rider.hi} ${c.rider.cls}  > ${PLACE[c.rider.dest]}`) : c?.drop ? `DROP OFF ${PLACE[c.drop]}` : "SEARCHING");
      const f = s.forks.find((o) => o.side === 0 && o.z - 400 < s.z && s.z < o.zDecide);
      set("fork", f ? `< ${NAME[f.left]}   ${NAME[f.right]} >` : "");
      set("callout", s.callout?.text ?? "");
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
        <div className="tl"><small>TIME</small><b id="time" /></div>
        <div className="tr"><small>SCORE</small><b id="score" /></div>
        <div className="bl"><small>KM/H</small><b id="speed" /></div>
        <div className="rail">
          <div id="bank" />
          <div id="seat0" /><div id="seat1" /><div id="seat2" />
          <div className="radar" id="radar" />
        </div>
        <div className="fork" id="fork" />
        <div className="callout" id="callout" />
      </div>
      {mode === "ready" && (
        <div className="overlay" onClick={() => loaded && setMode("play")}><h1>PICK UP BOOMERS</h1><p>{loaded ? "CLICK TO START" : "LOADING"}</p><p><small>arrows / WASD, P pauses</small></p></div>
      )}
      {mode === "paused" && <div className="overlay" onClick={() => setMode("play")}><h1>PAUSED</h1><p>CLOCK STOPPED</p></div>}
      {mode === "over" && (
        <div className="overlay">
          <h1>TIME IS UP</h1>
          <p className="big">{s.score}</p>
          <p>RIDERS {s.banked}  DISTANCE {Math.floor(s.dist * RATE)} ({Math.round(s.dist)} m)</p>
          {s.lost.length > 0 && <p>STILL ON BOARD: {s.lost.map((r) => `${r.name} ${agePoints(r.age)} LOST`).join(", ")}</p>}
          <p><button onClick={() => start(seed)}>SAME RUN</button> <button onClick={() => start(seed + 1)}>NEW RUN</button></p>
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
