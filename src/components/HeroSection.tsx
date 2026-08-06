"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

// --- FARBEN ---
const tclColors = [
  "rgba(239, 68, 68, 0.9)",
  "rgba(34, 197, 94, 0.9)",
  "rgba(59, 130, 246, 0.9)",
  "rgba(203, 121, 19, 0.9)",
  "rgba(239, 68, 68, 0.9)",
];

const coreBeamColors = [
  "rgba(239, 68, 68, 0.5)",
  "rgba(34, 197, 94, 0.5)",
  "rgba(59, 130, 246, 0.5)",
  "rgba(203, 121, 19, 0.5)",
  "rgba(239, 68, 68, 0.5)",
];

const washBeamColors = [
  "rgba(239, 68, 68, 0.2)",
  "rgba(34, 197, 94, 0.2)",
  "rgba(59, 130, 246, 0.2)",
  "rgba(203, 121, 19, 0.2)",
  "rgba(239, 68, 68, 0.2)",
];

const glowColors = [
  "rgba(239, 68, 68, 0.12)",
  "rgba(34, 197, 94, 0.12)",
  "rgba(59, 130, 246, 0.12)",
  "rgba(203, 121, 19, 0.12)",
  "rgba(239, 68, 68, 0.12)",
];

// --- INTERAKTIVER NEBEL ---
const InteractiveFog = () => {
  return (
    // GEÄNDERT: z-15 zu z-40
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(203, 121, 19, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(31, 87, 50, 0.15) 0%, transparent 50%)",
          willChange: "opacity"
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none mix-blend-screen"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(203, 121, 19, 0.08) 40%, transparent 70%)",
          willChange: "transform, opacity"
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

// --- SPOT-KOMPONENTE ---
const TclSpot = () => {
  return (
    <div className="relative flex flex-col items-start w-[120px] md:w-[150px] h-[120px] md:h-[150px]">
      {/* Äußerer Strahl (washBeamColors) entfernt auf User-Wunsch */}

      <motion.div
        className="absolute origin-top mix-blend-screen pointer-events-none"
        style={{
          top: "75px", left: "75px", width: "45vw", height: "100vh",
          x: "-50%", rotate: -45,
          clipPath: "polygon(49.5% 0, 50.5% 0, 100% 100%, 0% 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
        }}
        animate={{ background: coreBeamColors.map(c => `linear-gradient(to bottom, ${c}, transparent 100%)`) }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute z-20 mix-blend-screen blur-[12px] rounded-full"
        style={{ top: "55px", left: "55px", width: "40px", height: "40px" }}
        animate={{ backgroundColor: coreBeamColors }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg viewBox="0 0 150 150" className="relative z-10 w-[120px] md:w-[150px] h-[120px] md:h-[150px] drop-shadow-2xl overflow-visible">
        <path d="M 75 5 L 55 40 L 55 75" fill="none" stroke="#111" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="55" cy="75" r="6" fill="#222" />

        <g transform="rotate(45 75 75)">
          <path d="M 50 50 L 100 45 L 100 105 L 50 100 Z" fill="#1f1f1f" stroke="#0a0a0a" strokeWidth="2" />
          <ellipse cx="50" cy="75" rx="10" ry="25" fill="#171717" stroke="#0a0a0a" strokeWidth="2" />
          <ellipse cx="100" cy="75" rx="15" ry="30" fill="#050505" stroke="#222" strokeWidth="2" />

          <g>
            <motion.ellipse cx="100" cy="75" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="100" cy="62" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="100" cy="88" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="95" cy="68" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="95" cy="82" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="105" cy="68" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
            <motion.ellipse cx="105" cy="82" rx="3" ry="5" animate={{ fill: tclColors }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default function HeroSection() {
  const t = useTranslations("Hero");

  return (
    <section
      id="start"
      className="relative h-[100dvh] md:min-h-screen w-full bg-base-light overflow-hidden flex flex-col"
    >
      {/* --- Sunburst BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-80">
        <motion.div
          className="absolute bottom-0 left-[50%] w-[200vmax] h-[200vmax] origin-bottom"
          style={{
            x: "-50%",
            background:
              "repeating-conic-gradient(from 0deg at 50% 100%, var(--color-canvas-light) 0deg 8deg, var(--color-base-light) 8deg 16deg)",
            willChange: "transform"
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ repeat: Infinity, duration: 180, ease: "linear" }}
        />
      </div>

      {/* --- UMGEBUNGS-GLOW --- */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none mix-blend-multiply"
        style={{ willChange: "transform" }}
        animate={{ background: glowColors.map(c => `radial-gradient(circle at 50% 50%, ${c}, transparent 65%)`) }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* --- INTERAKTIVER NEBEL --- */}
      <InteractiveFog />

      {/* --- Die BEIDEN TCL SPOTS --- */}
      {/* GEÄNDERT: z-10 zu z-30 damit das Licht über der Bühne, aber hinter dem Content liegt */}
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden max-w-[1600px] mx-auto w-full">
        <div className="absolute top-2 -left-6 md:-left-8 lg:-left-2 origin-top rotate-[25deg] md:rotate-0">
          <TclSpot />
        </div>
        <div className="absolute top-2 -right-6 md:-right-8 lg:-right-2 origin-top scale-x-[-1] -rotate-[25deg] md:rotate-0">
          <TclSpot />
        </div>
      </div>

      {/* --- CONTENT WRAPPER --- */}
      {/* GEÄNDERT: z-20 zu z-50, damit der gesamte Inhalt (inkl. Buttons) vor der Bühne liegt */}
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 relative z-50 flex-grow flex flex-col h-full pt-[80px] sm:pt-[100px] md:pt-[120px] pb-28 md:pb-48">

        <div className="flex-[0.5] sm:flex-[1] md:flex-[2]"></div>

        {/* --- LOGO & GRAFIK --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full flex flex-col md:flex-row items-center justify-center gap-2 sm:gap-4 md:gap-8 drop-shadow-xl shrink-0"
        >
          {/* Text Bereich */}
          <div className="flex flex-col items-center md:items-end justify-center leading-[0.85] text-accent-green text-center md:text-right relative z-10">
            <span className="font-display font-black text-[72px] sm:text-[80px] md:text-[120px] lg:text-[160px] tracking-tighter">
              MAURER
            </span>
            <span className="font-display font-black text-[72px] sm:text-[80px] md:text-[120px] lg:text-[160px] tracking-tighter">
              EVENTS
            </span>
            <span className="font-sans font-bold text-base sm:text-base md:text-xl lg:text-3xl tracking-[0.2em] mt-3 md:mt-4 md:mr-2">
              seit 2025
            </span>
          </div>

          {/* Männchen Grafik */}
          <div className="h-[180px] sm:h-[180px] md:h-[200px] lg:h-[260px] shrink-0 relative mt-4 md:-mt-4">
            <motion.div
              className="absolute inset-[-40px] z-[-1] opacity-70 mix-blend-screen"
              style={{ willChange: "transform" }}
              animate={{ 
                background: washBeamColors.map(c => `radial-gradient(circle at 50% 50%, ${c}, transparent 65%)`)
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <img
              src="/maennchen-kopie.svg"
              alt="Maurer Events Festwirt"
              className="w-auto h-full object-contain relative z-10"
            />
          </div>
        </motion.div>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-start pt-8 md:pt-12 w-full shrink-0">
          {/* GEÄNDERT: z-30 zu z-50 (obwohl es durch den Parent z-50 ohnehin vorne ist, zur Sicherheit beibehalten) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col md:flex-row gap-4 justify-center w-full max-w-md md:max-w-none relative z-50 px-6 sm:px-4"
          >
            <Link
              href="/#contact"
              className="w-full md:w-auto px-8 py-4 bg-accent-wood text-white rounded-full font-display font-bold tracking-wide hover:bg-accent-green transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3 text-base text-center"
            >
              {t("cta_primary")}
            </Link>
            <Link
              href="/#events"
              className="w-full md:w-auto px-8 py-4 bg-accent-green text-white rounded-full font-display font-bold tracking-wide hover:bg-base-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3 text-base text-center"
            >
              {t("cta_secondary")}
            </Link>
          </motion.div>
        </div>

        <div className="flex-[0.5] md:flex-[1]"></div>
      </div>

      {/* --- UNTERER BEREICH: RESPONSIVE 3D BÜHNE & WAND --- */}
      {/* GEÄNDERT: z-30 zu z-10 */}
      <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none flex flex-col justify-end overflow-hidden">

        {/* 1. Bühnenboden */}
        <div
          className="relative w-full h-[22vh] sm:h-[26vh] md:h-[30vh] min-h-[160px] md:min-h-[260px]"
          style={{
            perspective: "1000px",
            WebkitMaskImage: "radial-gradient(ellipse 220% 120% at 50% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 85%)",
            maskImage: "radial-gradient(ellipse 220% 120% at 50% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 85%)",
          }}
        >
          {/* Das eigentliche 3D-Boden-Element */}
          <div
            className="absolute bottom-0 left-[50%] w-[320vw] sm:w-[280vw] md:w-[250vw] h-[250%] origin-bottom"
            style={{
              transform: "translateX(-50%) rotateX(68deg)",
              backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    rgba(0,0,0,0.5) 0px,
                    rgba(0,0,0,0.5) 5px,
                    transparent 5px,
                    transparent 120px
                  ),
                  linear-gradient(to top, #2C1A0F 0%, #150a04 100%)
                `
            }}
          >
            {/* Reflexion der Spots (auf User-Wunsch entfernt) */}
          </div>
        </div>

        {/* 2. Bühnenwand (Frontalansicht) */}
        {/* GEÄNDERT: z-40 zu z-20 */}
        <div className="w-full h-[7vh] sm:h-[8vh] md:h-[10vh] min-h-[50px] sm:min-h-[70px] md:min-h-[120px] bg-[#1a0f08] relative shadow-[0_-20px_50px_rgba(0,0,0,0.95)] z-20 border-t-[4px] md:border-t-[6px] border-[#3B2414]">

          {/* Helle Kante oben (Lichtkante) */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/10" />

          {/* Vertikale Paneele/Verkleidung */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    #140c07 0px,
                    #140c07 30px,
                    #0a0603 30px,
                    #0a0603 34px
                  )
                `
          }}></div>

          {/* Schattenwurf */}
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent opacity-80" />
        </div>

      </div>
    </section>
  );
}