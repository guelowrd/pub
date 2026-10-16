// The loading bar (ship kit's 14-segment bed) where CLICK TO START will be, over the splash scene itself, so a fast load
// is one screen settling and not two screens flashing.
const ART = `${import.meta.env.BASE_URL}art/loading/`;
// the desktop bed: 500 x 34, the fill clipped inside [6, 6, 488, 22]
const [BW, BH] = [500, 34], [CX, CY, CW, CH] = [6, 6, 488, 22];

export default function Loading({ progress }: { progress: number }) {
  return (
    <div className="loading-bar" style={{ aspectRatio: `${BW} / ${BH}` }}>
      <img src={`${ART}progress-bed.png`} alt="" />
      <img src={`${ART}progress-fill.png`} alt="" style={{ clipPath: `inset(${(CY / BH) * 100}% ${((BW - CX - CW * progress) / BW) * 100}% ${((BH - CY - CH) / BH) * 100}% ${(CX / BW) * 100}%)` }} />
      <span>{Math.round(progress * 100)} %</span>
    </div>
  );
}
