"use client";

import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Ticket } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-base-dark flex flex-col items-center justify-center relative overflow-hidden text-canvas-light selection:bg-accent-green selection:text-base-dark">
      
      {/* Background Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-green/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center max-w-2xl mx-auto">
        
        {/* Animated 404 Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          <motion.h1 
            initial={{ scale: 0.8, filter: "blur(10px)" }}
            animate={{ scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: "circOut" }}
            className="text-[12rem] leading-none md:text-[16rem] font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-accent-green via-white to-white/20 select-none"
          >
            404
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-dark border border-white/10 px-6 py-2 rounded-full rotate-[-5deg] shadow-2xl backdrop-blur-md"
          >
            <span className="text-xl font-bold tracking-widest text-accent-green uppercase">
              Verloren?
            </span>
          </motion.div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 text-white">
            Die Party ist nicht hier.
          </h2>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-lg mx-auto font-sans">
            Die Seite, die du suchst, wurde vielleicht verschoben, gelöscht oder hat nie existiert. Lass uns dich zurück zur Action bringen!
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto"
        >
          <Link 
            href="/"
            className="group relative flex items-center justify-center gap-3 bg-accent-green text-base-dark font-bold px-8 py-4 rounded-2xl overflow-hidden transition-transform hover:scale-105 active:scale-95"
          >
            <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-out" />
            <Home className="w-5 h-5" />
            <span>Zur Startseite</span>
          </Link>

          <Link 
            href="/termine/mit-reservierung"
            className="group flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-bold px-8 py-4 rounded-2xl hover:bg-white/10 transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
          >
            <Ticket className="w-5 h-5 text-accent-green" />
            <span>Zu den Events</span>
          </Link>
        </motion.div>
      </div>

      {/* Decorative Bottom Elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-0 w-full flex justify-center pointer-events-none"
      >
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <motion.div 
              key={i}
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.2, 1, 0.2]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
              className="w-2 h-2 rounded-full bg-accent-green"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
