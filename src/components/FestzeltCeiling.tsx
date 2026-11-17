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

// Gleiche Zelt-Decke wie im Events-Bereich der Landingpage (EventsSection):
// Giebel + Markise + Fluchtpunkt-Streben + pendelnde Banner. Der Eltern-
// Container muss relative + overflow-hidden sein und den Inhalt per
// pt-[280px] md:pt-[400px] lg:pt-[480px] unter der Decke beginnen lassen.
export default function FestzeltCeiling({ banners = true }: { banners?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const awningId = `scalloped-awning-${uid}`;
  const beamFadeId = `beam-fade-${uid}`;

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
          </defs>
          <g stroke={`url(#${beamFadeId})`} strokeWidth="2" strokeLinecap="round">
            {/* Center beam slightly offset to prevent zero-width bbox bug in SVG */}
            <line x1="49.9" y1="250" x2="50.1" y2="0" strokeWidth="3" />

            <line x1="50" y1="250" x2="35" y2="0" />
            <line x1="50" y1="250" x2="20" y2="0" />
            <line x1="50" y1="250" x2="5" y2="0" />

            <line x1="50" y1="250" x2="65" y2="0" />
            <line x1="50" y1="250" x2="80" y2="0" />
            <line x1="50" y1="250" x2="95" y2="0" />

            <line x1="33" y1="50" x2="67" y2="50" strokeWidth="1" opacity="0.4" />
            <line x1="25" y1="25" x2="75" y2="25" strokeWidth="0.8" opacity="0.3" />
            <line x1="16" y1="5" x2="84" y2="5" strokeWidth="0.5" opacity="0.2" />
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
            background: 'repeating-linear-gradient(90deg, var(--color-accent-green), var(--color-accent-green) 40px, var(--color-canvas-light) 40px, var(--color-canvas-light) 80px)',
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
