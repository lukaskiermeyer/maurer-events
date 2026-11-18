"use client";

import { useId } from "react";
import FestzeltBanner from "./FestzeltBanner";

const AWNING_CLIP_PATH = (() => {
  const numScallops = 16;
  let path = `M 0,0.25 L 0.5,0 L 1,0.25 L 1,0.5 `;

  for (let i = 0; i < numScallops; i++) {
    const startX = 1 - (0.5 / numScallops) * i;
    const startY = 0.5 - (0.25 / numScallops) * i;
    const endX = 1 - (0.5 / numScallops) * (i + 1);
    const endY = 0.5 - (0.25 / numScallops) * (i + 1);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 + 0.04; // 4% drop for the scallop
    path += `Q ${midX.toFixed(4)},${midY.toFixed(4)} ${endX.toFixed(4)},${endY.toFixed(4)} `;
  }

  for (let i = 0; i < numScallops; i++) {
    const startX = 0.5 - (0.5 / numScallops) * i;
    const startY = 0.25 + (0.25 / numScallops) * i;
    const endX = 0.5 - (0.5 / numScallops) * (i + 1);
    const endY = 0.25 + (0.25 / numScallops) * (i + 1);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 + 0.04;
    path += `Q ${midX.toFixed(4)},${midY.toFixed(4)} ${endX.toFixed(4)},${endY.toFixed(4)} `;
  }

  path += `Z`;
  return path;
})();

// Stoffbahnen wie im echten Festzelt: quer (links→rechts) gespannte Swags,
// die zwischen den Streben tief durchhängen. Reihen zum Fluchtpunkt hin
// schmaler und blasser. Ton im Wechsel grün/beige (Markenfarben).
// Detail: Längsfalten, helle Ober-/dunkle Unterkante, geraffte Pinch-Punkte
// und weicher Schlagschatten lassen die Bahnen wie echten Stoff wirken.
const SWAGS = (() => {
  const vp = { x: 50, y: 250 };
  // Äußere Punkte liegen bewusst außerhalb des Bilds, damit die Bahnen
  // bis über den Bildschirmrand laufen (bleed) statt an der äußersten Strebe zu enden.
  const strutTops = [-35, 5, 20, 35, 50, 65, 80, 95, 135];
  const hw0 = 2.0;
  const sagMul = [1, 0.94, 1.05, 0.96, 1.04, 0.92];
  const foldFr = [-0.55, -0.2, 0.2, 0.55];
  const rows = [
    { y: 24, tone: 'green' },
    { y: 38, tone: 'beige' },
    { y: 52, tone: 'green' },
    { y: 66, tone: 'beige' },
    { y: 80, tone: 'green' },
    { y: 92, tone: 'beige' },
  ];
  return rows.map(({ y, tone }) => {
    const f = (vp.y - y) / vp.y;
    const xs = strutTops.map((xt) => vp.x + (xt - vp.x) * f);
    const hw = hw0 * f;
    const green = tone === 'green';
    const segs = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      segs.push({ x0, x1, midX: (x0 + x1) / 2, sag: 0.9 * (x1 - x0) * sagMul[i % sagMul.length] });
    }
    const edgePath = (off) => {
      let d = `M ${xs[0].toFixed(2)},${(y + off).toFixed(2)}`;
      for (const s of segs) d += ` Q ${s.midX.toFixed(2)},${(y + s.sag + off).toFixed(2)} ${s.x1.toFixed(2)},${(y + off).toFixed(2)}`;
      return d;
    };
    const top = edgePath(-hw);
    const bottom = edgePath(hw);
    let band = `${top} L ${xs[xs.length - 1].toFixed(2)},${(y + hw).toFixed(2)}`;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      band += ` Q ${s.midX.toFixed(2)},${(y + s.sag + hw).toFixed(2)} ${s.x0.toFixed(2)},${(y + hw).toFixed(2)}`;
    }
    band += ' Z';
    const folds = foldFr.map((fr, idx) => ({
      d: edgePath(fr * hw),
      stroke: idx % 2 === 0
        ? (green ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.5)')
        : (green ? 'rgba(0,0,0,0.18)' : 'rgba(194,155,106,0.35)'),
      w: 0.25,
    }));
    let pinch = '';
    for (const x of xs) {
      pinch += `M ${x.toFixed(2)},${(y - hw).toFixed(2)} L ${x.toFixed(2)},${(y + hw).toFixed(2)} `;
      pinch += `M ${(x - 0.5).toFixed(2)},${(y - hw * 0.5).toFixed(2)} L ${(x - 0.3).toFixed(2)},${(y + hw * 0.5).toFixed(2)} `;
      pinch += `M ${(x + 0.5).toFixed(2)},${(y - hw * 0.5).toFixed(2)} L ${(x + 0.3).toFixed(2)},${(y + hw * 0.5).toFixed(2)} `;
    }
    return {
      shadow: band,
      band,
      top,
      bottom,
      folds,
      pinch,
      tone,
      edge: green ? 'none' : '#C29B6A',
      topStroke: green ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)',
      bottomStroke: green ? 'rgba(0,0,0,0.25)' : 'rgba(194,155,106,0.4)',
      pinchStroke: green ? 'rgba(0,0,0,0.3)' : 'rgba(194,155,106,0.45)',
    };
  });
})();

// Gleiche Zelt-Decke wie im Events-Bereich der Landingpage (EventsSection):
// Giebel + Markise + Fluchtpunkt-Streben + pendelnde Banner. Der Eltern-
// Container muss relative + overflow-hidden sein und den Inhalt per
// pt-[280px] md:pt-[400px] lg:pt-[480px] unter der Decke beginnen lassen.
export default function FestzeltCeiling({ banners = true }: { banners?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const awningId = `scalloped-awning-${uid}`;
  const beamFadeId = `beam-fade-${uid}`;
  const swagGreenId = `swag-green-${uid}`;
  const swagBeigeId = `swag-beige-${uid}`;
  const swagBlurId = `swag-blur-${uid}`;

  return (
    <>
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id={awningId} clipPathUnits="objectBoundingBox">
            <path d={AWNING_CLIP_PATH} />
          </clipPath>
        </defs>
      </svg>

      {/* Fluchtpunkt-Streben (Perspective Beams) */}
      <div className="absolute top-0 left-0 w-full h-[400px] md:h-[600px] z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[#F9F7F3] opacity-30"></div>

        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" className="opacity-90">
          <defs>
            <radialGradient id={beamFadeId} cx="50" cy="100" r="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C29B6A" stopOpacity="0" />
              <stop offset="30%" stopColor="#C29B6A" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C29B6A" stopOpacity="0.9" />
            </radialGradient>
            <linearGradient id={swagGreenId} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#20603C" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#20603C" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#20603C" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={swagBeigeId} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F4F0E8" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#F4F0E8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#F4F0E8" stopOpacity="0" />
            </linearGradient>
            <filter id={swagBlurId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>
          <g stroke={`url(#${beamFadeId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Center beam slightly offset to prevent zero-width bbox bug in SVG */}
            <line x1="49.9" y1="250" x2="50.1" y2="0" strokeWidth="3" />

            <line x1="50" y1="250" x2="35" y2="0" />
            <line x1="50" y1="250" x2="20" y2="0" />
            <line x1="50" y1="250" x2="5" y2="0" />

            <line x1="50" y1="250" x2="65" y2="0" />
            <line x1="50" y1="250" x2="80" y2="0" />
            <line x1="50" y1="250" x2="95" y2="0" />

          </g>

          {/* Stoffbahnen: quer gespannte Swags mit Falten, Kanten & Schatten */}
          <g>
            {SWAGS.map((s, i) => (
              <g key={i} className={i % 2 === 1 ? 'max-md:hidden' : undefined}>
                <path d={s.shadow} fill="#000" opacity="0.07" filter={`url(#${swagBlurId})`} transform="translate(0 1.2)" />
                <path d={s.band} fill={s.tone === 'green' ? `url(#${swagGreenId})` : `url(#${swagBeigeId})`} stroke={s.edge} strokeWidth="0.3" strokeOpacity="0.35" />
                {s.folds.map((fd, j) => (
                  <path key={j} d={fd.d} fill="none" stroke={fd.stroke} strokeWidth={fd.w} />
                ))}
                <path d={s.top} fill="none" stroke={s.topStroke} strokeWidth="0.3" />
                <path d={s.bottom} fill="none" stroke={s.bottomStroke} strokeWidth="0.35" />
                <path d={s.pinch} fill="none" stroke={s.pinchStroke} strokeWidth="0.25" opacity="0.6" />
              </g>
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-base-light/60 to-base-light"></div>
      </div>

      {banners && (
        <div className="absolute top-0 left-0 w-full h-[400px] md:h-[600px] z-10 pointer-events-none">
          <FestzeltBanner position="left" />
          <FestzeltBanner position="right" />
        </div>
      )}

      {/* Dach-Struktur (Giebel & Markise) */}
      <div className="absolute top-0 left-0 w-full h-[150px] md:h-[250px] z-20 pointer-events-none drop-shadow-2xl">
        <div
          className="absolute inset-0 bg-accent-green"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 25%, 0% 50%)' }}
        ></div>

        <div
          className="absolute inset-0"
          style={{
            background: 'var(--color-canvas-light)',
            clipPath: `url(#${awningId})`
          }}
        ></div>

        <svg
          className="absolute inset-0 w-full h-full z-30 pointer-events-none"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polyline
            points="0,25 50,0 100,25"
            fill="none"
            stroke="#171717"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </>
  );
}
