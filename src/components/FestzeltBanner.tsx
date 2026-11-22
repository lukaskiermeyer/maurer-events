"use client";

import { useId } from "react";
import { useLocale } from "next-intl";
import { motion, useScroll, useVelocity, useSpring, useTransform } from "framer-motion";
import { ui } from "@/lib/localize";

// Geometrie 1:1 aus der Druckvorlage public/neu_Bannerflagge_Maurer_V4.* (80 x 200 cm).
// viewBox-Einheiten = Original-Pixel / 5; Textanker/-größen gegen die Ink-Bboxen der
// Vorlage kalibriert (Aileron Heavy, Laufweite ~-0.088 em; "seit 2025" in Yeseva One).
const GREEN = "#18603E";
const CREAM = "#F7F7F1";
// Icon-Grün (#20613D) exakt auf das Grün der Druckvorlage (#18603E) abbilden
const FIGURE_RECOLOR = "0.75 0 0 0 0  0 0.989691 0 0 0  0 0 1.016393 0 0  0 0 0 1 0";

interface FestzeltBannerProps {
  position?: "left" | "right";
  compact?: boolean;
}

export default function FestzeltBanner({ position = "right", compact = false }: FestzeltBannerProps) {
  const locale = useLocale();
  // Markenname bleibt in allen Sprachen gleich; nur "seit" wird lokalisiert.
  const bannerLabel = ui(locale, { de: "MAURER EVENTS – seit 2025", en: "MAURER EVENTS – since 2025", bar: "MAURER EVENTS – seit 2025" });
  const figureFilterId = `banner-figure-${useId().replace(/:/g, "")}`;
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 12,    // Weniger Dämpfung für sanftes Auspendeln (pendulum effect)
    stiffness: 120, // Weichere Feder für eine natürlichere Bewegung
    mass: 1.5       // Etwas mehr Masse, damit es träger schwingt
  });

  // Maps scroll speed to rotation degrees (swings up to 10 degrees instead of 25)
  const velocityRotate = useTransform(smoothVelocity, [-1500, 0, 1500], [10, 0, -10]);

  // Das Banner hängt zwischen Strebe 2 (20%) und Strebe 3 (35%) von außen.
  // Aufgrund der Perspektive liegt die optische Mitte weiter innen, bei ca. 31.5%.
  const positionClass = position === "left"
    ? "left-[31.5%]"
    : "right-[31.5%]";

  return (
    <div
      className={`absolute ${positionClass} ${
        compact ? "top-[54px] md:top-[74px] lg:top-[74px] w-16 md:w-20 lg:w-24" : "top-[105px] md:top-[170px] lg:top-[230px] w-24 md:w-32 lg:w-36"
      } z-20`}
      style={{ transform: position === "left" ? "translateX(-50%)" : "translateX(50%)" }}
    >
      {/* Statische, extrem dünne Schnüre (hängen starr von der Decke) */}
      <svg viewBox="0 -140 1260 3290" className="absolute top-0 left-0 w-full h-auto overflow-visible pointer-events-none z-0">
        <line x1="126" y1="-4000" x2="126" y2="-70" stroke="#1A1A1A" strokeWidth="5" opacity="0.1" />
        <line x1="1134" y1="-4000" x2="1134" y2="-70" stroke="#1A1A1A" strokeWidth="5" opacity="0.1" />
      </svg>

      {/* Das Banner, das exakt an der horizontalen Stange pendelt */}
      <motion.div
        className="relative w-full z-10 drop-shadow-2xl"
        role="img"
        aria-label={bannerLabel}
        style={{
          rotate: velocityRotate,
          transformOrigin: "50% 2.13%" // Exakt auf Höhe der Stange (y=-70 von 3290)
        }}
      >
        <svg viewBox="0 -140 1260 3290" className="block w-full h-auto overflow-visible">
          {/* Horizontal Metal Rod */}
          <line x1="-95" y1="-70" x2="1355" y2="-70" stroke="#4A4A4A" strokeWidth="42" strokeLinecap="round" />

          {/* Banner Background: Schnittkante der Druckvorlage (Pointed Pennant) */}
          <polygon points="0,0 1260,0 1260,2775 630,3150 0,2775" fill={CREAM} />
          {/* Banner Inner Border */}
          <polygon points="113.5,121.5 1146.5,121.5 1146.5,2704 630,3011.5 113.5,2704" fill="none" stroke={GREEN} strokeWidth="18" />

          <defs>
            <filter id={figureFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={FIGURE_RECOLOR} />
            </filter>
          </defs>
          <image href="/Icon_MaurerGrün.svg" x="104.9" y="607.7" width="1068.4" height="1068.4" filter={`url(#${figureFilterId})`} />

          <text x="1089.8" y="1770" textAnchor="end" fill={GREEN} fontFamily="var(--font-sans)" fontWeight={800} fontSize={252.5} letterSpacing={-21.8}>MAURER</text>
          <text x="1089.2" y="1961" textAnchor="end" fill={GREEN} fontFamily="var(--font-sans)" fontWeight={800} fontSize={252.5} letterSpacing={-22.2}>EVENTS</text>
          <text x="1104.2" y="2040" textAnchor="end" fill={GREEN} fontFamily="var(--font-subhead)" fontWeight={400} fontSize={77.8} letterSpacing={-0.3}>seit 2025</text>
        </svg>
      </motion.div>
    </div>
  );
}