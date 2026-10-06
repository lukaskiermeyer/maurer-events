"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error securely to the console/reporting service
    // Der User sieht diese Details nicht auf dem Bildschirm!
    console.error("Ein unerwarteter Fehler ist aufgetreten:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-base-dark flex flex-col items-center justify-center relative overflow-hidden text-canvas-light selection:bg-red-500/30 selection:text-white">
      
      {/* Background Glow Effects - Leicht rötlich für den Fehler-State */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center max-w-2xl mx-auto mt-20">
        
        {/* Animated Error Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <motion.div
            initial={{ scale: 0.8, filter: "blur(10px)", rotate: -10 }}
            animate={{ scale: 1, filter: "blur(0px)", rotate: 0 }}
            transition={{ duration: 1, ease: "circOut" }}
            className="flex justify-center"
          >
            <AlertTriangle className="w-32 h-32 md:w-48 md:h-48 text-red-500/80 drop-shadow-[0_0_30px_rgba(239,68,68,0.3)]" />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-dark border border-red-500/20 px-6 py-2 rounded-full rotate-[5deg] shadow-2xl backdrop-blur-md"
          >
            <span className="text-xl font-bold tracking-widest text-red-400 uppercase">
              Hoppla!
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
            Da ist etwas schiefgelaufen.
          </h2>
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-lg mx-auto font-sans">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut. Wenn der Fehler bestehen bleibt, kontaktiere uns.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto z-20 relative"
        >
          <button 
            onClick={() => reset()}
            className="group relative flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-8 py-4 rounded-2xl overflow-hidden transition-transform hover:scale-105 active:scale-95 hover:bg-red-500/20"
          >
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            <span>Nochmal versuchen</span>
          </button>

          <Link 
            href="/"
            className="group relative flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-bold px-8 py-4 rounded-2xl hover:bg-white/10 transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
          >
            <Home className="w-5 h-5" />
            <span>Zur Startseite</span>
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
              className="w-2 h-2 rounded-full bg-red-500/50"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
