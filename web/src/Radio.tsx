// The car radio (handoff 05): the designer's layers laid out from radio-anchors.json, one face per layout. Tuning moves
// the needle between the painted detents and plays the station; the LCD shows title, mood and number; the VU follows
// the music; the volume knob turns and mutes on press; the ignition key is DRIVE.
import { useEffect, useRef, useState } from "react";
import anchors from "./game/data/radio-anchors.json";
import { STATIONS } from "./game/stations";
import { audio } from "./audio";

type Layout = "desktop" | "portrait" | "landscape";
type Layer = { id: string; rect: number[]; layout_position: number[]; role: string; pivot_local: number[] | null };
const ART = `${import.meta.env.BASE_URL}art/radio/`;
const px = (n: number) => `${n}px`;

export function pickLayout(w: number, h: number): Layout {
  return h > w ? "portrait" : h < 460 ? "landscape" : "desktop";
}

export default function Radio({ station, setStation, volume, setVolume, muted, onDrive }: {
  station: number; setStation: (i: number) => void; volume: number; setVolume: (v: number) => void; muted: boolean; onDrive: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => pickLayout(innerWidth, innerHeight));
  const [scale, setScale] = useState(1);
  const [turning, setTurning] = useState(false);
  const [levels, setLevels] = useState([0, 0]);
  const vuRaf = useRef(0);
  const L = anchors.layouts[layout];
  const [sw, sh] = L.screen_size, [ox, oy] = L.origin;

  useEffect(() => {
    const fit = () => {
      const lay = pickLayout(innerWidth, innerHeight), l = anchors.layouts[lay];
      const box = lay === "desktop" ? Math.min(innerWidth, innerHeight * 4 / 3) / l.screen_size[0] : Math.min(innerWidth / l.screen_size[0], innerHeight / l.screen_size[1]);
      setLayout(lay); setScale(box);
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    const tick = () => { setLevels(audio.levels()); vuRaf.current = requestAnimationFrame(tick); };
    vuRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(vuRaf.current);
  }, []);

  const tune = (d: number) => setStation((station + d + STATIONS.length) % STATIONS.length);
  const drive = () => { if (turning) return; setTurning(true); setTimeout(onDrive, 260); };
  const needle = L.needle, lcd = L.lcd, vol = L.volume, ign = L.ignition;
  const needleX = needle.x_min + station * (needle.x_max - needle.x_min) / 13;
  const st = STATIONS[station];
  const titlePx = st.title.length > 15 ? (layout === "desktop" ? 28 : layout === "portrait" ? 18 : 20) : lcd.title_font_px;
  const layers = L.layers as Layer[];
  const style = (l: Layer, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: "absolute", left: px(l.layout_position[0]), top: px(l.layout_position[1]), width: px(l.rect[2]), height: px(l.rect[3]), ...extra });

  return (
    <div className="radio-screen" style={{ width: px(sw), height: px(sh), transform: `scale(${scale})` }}>
      <h1 className="radio-title">RADIO SELECT</h1>
      <div className="radio-face" style={{ left: px(ox), top: px(oy), width: px(L.component_size[0]), height: px(L.component_size[1]) }}>
        {layers.map((l) => {
          if (l.role.startsWith("preview")) return null;
          if (l.id === "needle") return <img key={l.id} src={`${ART}${layout}/needle.png`} alt="" style={style(l, { transform: `translateX(${needleX - needle.initial_x}px)`, transition: "transform .25s" })} />;
          if (l.id === "volume-pointer") return <img key={l.id} src={`${ART}${layout}/volume-pointer.png`} alt="" style={style(l, { transformOrigin: `${l.pivot_local![0]}px ${l.pivot_local![1]}px`, transform: `rotate(${(volume - 0.5) * 270}deg)` })} />;
          if (l.id === "ignition-key") return <img key={l.id} src={`${ART}${layout}/ignition-key.png`} alt="" style={style(l, { transformOrigin: `${l.pivot_local![0]}px ${l.pivot_local![1]}px`, transform: `rotate(${turning ? 30 : 0}deg)`, transition: "transform .2s" })} />;
          if (l.id === "vu-lit") return (
            <span key={l.id}>
              <img src={`${ART}${layout}/vu-lit.png`} alt="" style={style(l, { clipPath: `inset(0 ${(1 - levels[0]) * 100}% 50% 0)` })} />
              <img src={`${ART}${layout}/vu-lit.png`} alt="" style={style(l, { clipPath: `inset(50% ${(1 - levels[1]) * 100}% 0 0)` })} />
            </span>
          );
          return <img key={l.id} src={`${ART}${layout}/${l.id}.png`} alt="" style={style(l)} />;
        })}
        <div className="lcd-text" style={{ left: px(lcd.title_clip[0]), top: px(lcd.title_clip[1]), width: px(lcd.title_clip[2]), height: px(lcd.title_clip[3]) }}>
          <span style={{ left: px(lcd.title_baseline[0] - lcd.title_clip[0]), bottom: px(lcd.title_clip[1] + lcd.title_clip[3] - lcd.title_baseline[1]), fontSize: px(titlePx) }}>{st.title}</span>
        </div>
        <div className="lcd-text" style={{ left: px(lcd.mood_clip[0]), top: px(lcd.mood_clip[1]), width: px(lcd.mood_clip[2]), height: px(lcd.mood_clip[3]) }}>
          <span style={{ left: px(lcd.mood_baseline[0] - lcd.mood_clip[0]), bottom: px(lcd.mood_clip[1] + lcd.mood_clip[3] - lcd.mood_baseline[1]), fontSize: px(lcd.mood_font_px) }}>{muted ? "SOUND OFF" : st.mood}</span>
        </div>
        <span className="lcd-no" style={{ right: px(L.component_size[0] - lcd.rect[0] - lcd.rect[2] + 10), top: px(lcd.rect[1] + 8), fontSize: px(Math.round(lcd.mood_font_px * 0.8)) }}>{String(station + 1).padStart(2, "0")}</span>
        <button className="hit" aria-label="Tune down" style={{ left: px(L.tune_left_hit[0]), top: px(L.tune_left_hit[1]), width: px(L.tune_left_hit[2]), height: px(L.tune_left_hit[3]) }} onClick={() => tune(-1)} />
        <button className="hit" aria-label="Tune up" style={{ left: px(L.tune_right_hit[0]), top: px(L.tune_right_hit[1]), width: px(L.tune_right_hit[2]), height: px(L.tune_right_hit[3]) }} onClick={() => tune(1)} />
        <button className="hit" aria-label={muted ? "Sound off, press for sound" : "Volume, press to mute"} style={{ left: px(vol.hit_rect[0]), top: px(vol.hit_rect[1]), width: px(vol.hit_rect[2]), height: px(vol.hit_rect[3]), borderRadius: "50%" }}
          onClick={() => audio.toggle()} onWheel={(e) => setVolume(Math.max(0, Math.min(1, volume - Math.sign(e.deltaY) * 0.1)))} />
        <button className="hit" aria-label="Drive" style={{ left: px(ign.hit_rect[0]), top: px(ign.hit_rect[1]), width: px(ign.hit_rect[2]), height: px(ign.hit_rect[3]), borderRadius: "50%" }} onClick={drive} />
      </div>
    </div>
  );
}
