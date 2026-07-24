"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-base-light" id="start">
      
      {/* Softer Background Accent instead of brutalist grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
        <div className="w-[80vw] h-[80vw] bg-accent-green rounded-full blur-[150px] opacity-10"></div>
      </div>

      <div className="relative z-10 px-4 sm:px-8 lg:px-16 w-full max-w-[1600px] mx-auto flex flex-col items-center justify-center h-full">
        
        {/* Massive Central Logo Wordmark */}
        <div className="flex flex-col items-center justify-center w-full text-center mt-12 md:mt-0 relative z-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <h1 className="font-display font-black text-[16vw] md:text-[11vw] leading-[0.8] text-base-dark uppercase tracking-tighter">
              MAURER
            </h1>
            <h1 className="font-display font-black text-[16vw] md:text-[11vw] leading-[0.8] text-accent-green uppercase tracking-tighter">
              EVENTS
            </h1>
          </motion.div>
        </div>

        {/* Info & CTA at the bottom */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="absolute bottom-12 md:bottom-20 left-0 w-full px-4 sm:px-8 lg:px-16 flex flex-col md:flex-row justify-between items-center md:items-end z-30"
        >
          <div className="text-center md:text-left mb-8 md:mb-0">
            <p className="font-sans text-sm md:text-base text-accent-wood uppercase font-bold mb-2 tracking-widest">Seit 2025</p>
            <p className="font-sans text-base md:text-lg font-medium text-base-dark/80 max-w-sm">
              Wir planen, du feierst. <br/> Tradition trifft modernes Event-Management.
            </p>
          </div>
          
          <div>
            <Link
              href="#contact"
              className="group inline-flex items-center justify-center px-10 py-4 bg-accent-wood text-white font-display font-bold text-lg rounded-2xl shadow-lg transition-all hover:bg-base-dark hover:-translate-y-1 hover:shadow-xl"
            >
              Anfrage starten
              <svg className="ml-4 w-5 h-5 transform transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* 
        Walking Figure Animation Container
        Hier kannst du deine Figur animieren, sodass sie vor oder hinter dem großen Text entlangläuft.
        Z-Index 10 bedeutet, sie ist HINTER dem Text. Wenn sie VOR dem Text sein soll, setze z-30 oder höher.
      */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      >
        <motion.img 
          src="/figur-transparent.png" 
          alt="Festwirt Figur" 
          /* Deine geplante Animation kommt hier rein, z.B. x: ["-100vw", "100vw"] */
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }} 
          transition={{ duration: 1.5, delay: 0.3 }}
          className="h-auto w-[60vw] md:w-[30vw] drop-shadow-2xl object-contain opacity-50"
          onError={(e) => {
             e.currentTarget.style.display = 'none';
          }}
        />
      </motion.div>
      
    </section>
  );
}
