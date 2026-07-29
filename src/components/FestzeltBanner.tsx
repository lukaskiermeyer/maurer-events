"use client";

import { motion, useScroll, useVelocity, useSpring, useTransform } from "framer-motion";

interface FestzeltBannerProps {
  position?: "left" | "right";
}

export default function FestzeltBanner({ position = "right" }: FestzeltBannerProps) {
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
      className={`absolute ${positionClass} top-16 md:top-28 lg:top-40 z-20 w-28 md:w-40 lg:w-48`}
      style={{ transform: position === "left" ? "translateX(-50%)" : "translateX(50%)" }}
    >
      {/* Statische, extrem dünne Schnüre (hängen starr von der Decke) */}
      <svg viewBox="0 0 240 460" className="absolute top-0 left-0 w-full h-auto overflow-visible pointer-events-none z-0">
        <line x1="40" y1="-800" x2="40" y2="100" stroke="#1A1A1A" strokeWidth="1" opacity="0.1" />
        <line x1="200" y1="-800" x2="200" y2="100" stroke="#1A1A1A" strokeWidth="1" opacity="0.1" />
      </svg>

      {/* Das Banner, das exakt an der horizontalen Stange pendelt */}
      <motion.div 
        className="relative flex flex-col items-center drop-shadow-2xl w-full z-10"
        style={{
          rotate: velocityRotate,
          transformOrigin: "50% 18.5%" // Exakt auf Höhe der Stange (y=100 von 540)
        }}
      >
        <svg viewBox="0 0 240 540" className="w-full h-auto overflow-visible">
          {/* Horizontal Metal Rod */}
          <line x1="5" y1="100" x2="235" y2="100" stroke="#4A4A4A" strokeWidth="8" strokeLinecap="round" />
          
          {/* Banner Background */}
          <polygon points="20,104 220,104 220,460 120,520 20,460" fill="#FFFFFF" />
        {/* Banner Inner Border */}
        <polygon points="32,116 208,116 208,453 120,506 32,453" fill="none" stroke="#1F5732" strokeWidth="4" />
      </svg>
      {/* Content overlay */}
      <div className="absolute top-[20%] left-0 w-full h-[80%] pb-[20%] px-6 flex flex-col items-center justify-center pointer-events-none">
        <img src="/mann.png" alt="Festwirt Figur" className="w-[65%] md:w-[70%] h-auto object-contain mb-3 filter drop-shadow-md" />
        
        <div className="flex flex-col items-center">
          <h4 className="font-display font-black text-center text-accent-green text-[12px] md:text-base lg:text-lg leading-tight tracking-widest uppercase">
            MAURER<br/>EVENTS
          </h4>
          <span className="font-sans text-accent-green text-[7px] md:text-[9px] lg:text-[10px] mt-1 opacity-90 tracking-widest uppercase">
            seit 2025
          </span>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
