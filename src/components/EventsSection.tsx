"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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

export default function EventsSection({ initialEvents }: { initialEvents: any[] }) {
  return (
    <section id="events" className="relative w-full bg-base-light py-24 md:py-32 overflow-hidden">
      
      {/* 3D Tent Background Elements */}
      {/* SVG ClipPath Definition for Scallops */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id="scalloped-awning" clipPathUnits="objectBoundingBox">
            <path d={AWNING_CLIP_PATH} />
          </clipPath>
        </defs>
      </svg>
      
      {/* Fluchtpunkt-Streben (Perspective Beams) */}
      <div className="absolute top-0 left-0 w-full h-[400px] md:h-[600px] z-0 pointer-events-none overflow-hidden">
        {/* White canvas ceiling background */}
        <div className="absolute inset-0 bg-[#F9F7F3] opacity-30"></div>
        
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" className="opacity-90">
          <defs>
            <radialGradient id="beam-fade" cx="50" cy="100" r="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C29B6A" stopOpacity="0" />
              <stop offset="30%" stopColor="#C29B6A" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C29B6A" stopOpacity="0.9" />
            </radialGradient>
          </defs>
          <g stroke="url(#beam-fade)" strokeWidth="2" strokeLinecap="round">
            {/* Center Beam (Ridge) - slightly offset to prevent zero-width bbox bug in SVG */}
            <line x1="49.9" y1="250" x2="50.1" y2="0" strokeWidth="3" />
            
            {/* Left Beams (3 per side) - strictly inside visible bounds */}
            <line x1="50" y1="250" x2="35" y2="0" />
            <line x1="50" y1="250" x2="20" y2="0" />
            <line x1="50" y1="250" x2="5" y2="0" />
            
            {/* Right Beams (3 per side) - strictly inside visible bounds */}
            <line x1="50" y1="250" x2="65" y2="0" />
            <line x1="50" y1="250" x2="80" y2="0" />
            <line x1="50" y1="250" x2="95" y2="0" />

            {/* Horizontal Cross Beams */}
            <line x1="33" y1="50" x2="67" y2="50" strokeWidth="1" opacity="0.4" />
            <line x1="25" y1="25" x2="75" y2="25" strokeWidth="0.8" opacity="0.3" />
            <line x1="16" y1="5" x2="84" y2="5" strokeWidth="0.5" opacity="0.2" />
          </g>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-base-light/60 to-base-light"></div>
      </div>

      {/* Banners (hanging inside the tent) */}
      <div className="absolute top-0 left-0 w-full h-[400px] md:h-[600px] z-10 pointer-events-none">
        <FestzeltBanner position="left" />
        <FestzeltBanner position="right" />
      </div>

      {/* Dach-Struktur (Giebel & Markise) */}
      <div className="absolute top-0 left-0 w-full h-[150px] md:h-[250px] z-20 pointer-events-none drop-shadow-2xl">
        {/* Konstantes grünes Dach (füllt die oberen Ecken aus) */}
        <div 
          className="absolute inset-0 bg-accent-green"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 25%, 0% 50%)' }}
        ></div>

        {/* Grün-weiße Markise mit Rüschen (Scalloped Edge) */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(90deg, var(--color-accent-green), var(--color-accent-green) 40px, var(--color-canvas-light) 40px, var(--color-canvas-light) 80px)',
            clipPath: 'url(#scalloped-awning)'
          }}
        ></div>

        {/* Dünner schwarzer Strich als obere Umrandung */}
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

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 mt-[200px] md:mt-[280px] lg:mt-[350px] relative z-30">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-6">
          <div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="font-display font-bold text-5xl md:text-7xl mb-4 text-base-dark"
            >
              Unsere <span className="text-accent-green">Termine</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-sans text-lg text-base-dark/60 font-medium"
            >
              Komm vorbei und feier mit uns
            </motion.p>
          </div>
          <motion.div
             initial={{ opacity: 0, x: 20 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2 }}
          >
            <Link href="/termine" className="text-base-dark bg-border-light px-6 py-3 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide flex items-center gap-3 transition-colors text-sm shadow-sm">
              Alle Termine
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </motion.div>
        </div>

        <div className="space-y-4">
          {initialEvents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-accent-green/20 rounded-3xl p-12 md:p-24 text-center flex flex-col items-center justify-center"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 text-accent-green shadow-sm">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-display font-black text-3xl md:text-5xl text-base-dark mb-4">Bald gibt's was zu <span className="text-accent-green">feiern!</span></h3>
              <p className="font-sans text-base-dark/70 max-w-lg mx-auto text-lg leading-relaxed">
                Der Wirt feilt gerade noch am Programm. Sobald die nächsten Termine feststehen, findest du sie genau hier. Schau bald wieder vorbei!
              </p>
            </motion.div>
          ) : (
            initialEvents.map((event: any, index: number) => {
            const dateObj = new Date(event.date);
            const dateStr = dateObj.toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link href={`/termine/${event.id}`} className="group bg-white border border-border-light rounded-2xl flex flex-col md:flex-row md:items-center relative hover:border-accent-green hover:shadow-lg transition-all duration-300 overflow-hidden block">
                  <div className="md:w-1/4 p-6 md:p-8 bg-border-light/30 group-hover:bg-accent-green/10 transition-colors flex flex-col justify-center border-b md:border-b-0 md:border-r border-border-light relative overflow-hidden">
                    {event.imageUrl && (
                      <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${event.imageUrl})` }}></div>
                    )}
                    <div className="relative z-10">
                      <span className="text-accent-green font-bold text-xs tracking-widest uppercase mb-1">Datum</span>
                      <span className="font-display font-bold text-2xl md:text-3xl text-base-dark">{dateStr}</span>
                    </div>
                  </div>
                  
                  <div className="md:w-2/4 p-6 md:p-8">
                    <h4 className="font-display font-bold text-2xl md:text-3xl mb-2 text-base-dark">{event.title}</h4>
                    {event.reservable && (
                      <span className="inline-block bg-base-dark text-white font-bold text-xs uppercase tracking-widest px-3 py-1 mb-3 shadow-md">
                        Tische reservierbar
                      </span>
                    )}
                    <p className="font-sans text-sm md:text-base text-base-dark/70 mb-4">{event.description}</p>
                    <div className="flex items-center gap-2 text-sm font-bold text-accent-green">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.location}
                    </div>
                  </div>

                  <div className="md:w-1/4 p-6 md:p-8 flex md:justify-end items-center transition-colors h-full">
                    <button className="flex items-center justify-center w-12 h-12 bg-border-light text-base-dark rounded-full group-hover:bg-accent-green group-hover:text-white transition-colors">
                       <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                       </svg>
                    </button>
                  </div>
                </Link>
              </motion.div>
            );
          }))}
        </div>
      </div>
    </section>
  );
}
