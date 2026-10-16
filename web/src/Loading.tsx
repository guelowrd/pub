// The loading screen (ship kit): the splash's city and title with the hero car, and a 14-segment progress bed, one
// layout each for desktop, portrait and landscape phones.
import { pickLayout } from "./HeadUnit";

const ART = `${import.meta.env.BASE_URL}art/loading/`;
const L = {
  desktop: { canvas: [1280, 960], bar: [390, 418], bed: [500, 34], clip: [6, 6, 488, 22], pct: [640, 486], size: 28 },
  portrait: { canvas: [390, 844], bar: [55, 318], bed: [280, 22], clip: [4, 4, 272, 14], pct: [195, 366], size: 23 },
  landscape: { canvas: [740, 340], bar: [220, 158], bed: [300, 18], clip: [4, 4, 292, 10], pct: [370, 190], size: 17 },
};
const px = (n: number) => `${n}px`;

export default function Loading({ progress }: { progress: number }) {
  const layout = pickLayout(innerWidth, innerHeight), g = L[layout];
  const scale = Math.min(innerWidth / g.canvas[0], innerHeight / g.canvas[1]);
  const [cx, cy, cw, ch] = g.clip, [bw, bh] = g.bed;
  return (
    <div className="loading-screen" style={{ width: px(g.canvas[0]), height: px(g.canvas[1]), transform: `scale(${scale})` }}>
      {["background", "title", "car"].map((l) => <img key={l} src={`${ART}${layout}/${l}.webp`} alt="" style={{ left: 0, top: 0, width: px(g.canvas[0]), height: px(g.canvas[1]) }} />)}
      <img src={`${ART}${layout}/progress-bed.png`} alt="" style={{ left: px(g.bar[0]), top: px(g.bar[1]), width: px(bw), height: px(bh) }} />
      <img src={`${ART}${layout}/progress-fill.png`} alt="" style={{ left: px(g.bar[0]), top: px(g.bar[1]), width: px(bw), height: px(bh), clipPath: `inset(${cy}px ${bw - cx - cw * progress}px ${bh - cy - ch}px ${cx}px)` }} />
      <span style={{ left: 0, width: px(g.canvas[0]), top: px(g.pct[1] - 0.86 * g.size), fontSize: px(g.size) }}>{Math.round(progress * 100)} %</span>
    </div>
  );
}
