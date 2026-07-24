"use client";

import { motion } from "framer-motion";

export default function AboutSection() {
  return (
    <section id="about" className="py-24 md:py-32 bg-base-light border-t border-base-dark overflow-hidden relative">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-center">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-5 relative"
          >
            <h2 className="font-display font-bold text-5xl md:text-7xl text-base-dark leading-[1.1] mb-8">
              Dein <br/><span className="text-accent-green">Festwirt</span>
            </h2>
            {/* Image Florian Maurer */}
            <div className="aspect-[4/5] w-full bg-canvas-light border border-accent-wood/30 rounded-3xl relative shadow-xl overflow-hidden group">
              <img 
                src="/florian.jpg" 
                alt="Florian Maurer - Festwirt" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            
            {/* Soft Decoration */}
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-accent-wood/10 rounded-full blur-2xl -z-10"></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="lg:col-span-6 lg:col-start-7 pt-4 lg:pt-12"
          >
            <h3 className="font-sans text-sm md:text-base text-accent-wood font-bold uppercase tracking-widest mb-8">
              Bayerische Wurzeln. Moderne Feste.
            </h3>
            
            <div className="space-y-8 font-sans text-lg md:text-xl text-base-dark/80 leading-relaxed">
              <p>
                Ich bin Florian Maurer – für viele einfach &quot;da Maurerwirt&quot;. Mit Wurzeln in der Metzgerei Halbauer habe ich früh gelernt, was Qualität und echte Gastfreundschaft bedeuten. Heute bringe ich diese Tradition in die moderne Eventwelt.
              </p>
              <p>
                Ob zünftiges Volksfest, elegantes Firmenjubiläum oder das ganz persönliche Vereinsfest – wir verbinden bayerische Herzlichkeit mit präziser Planung und moderner Ästhetik.
              </p>
              
              <div className="bg-canvas-light rounded-2xl p-8 border border-border-light shadow-sm my-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-accent-wood"></div>
                <p className="font-display font-bold text-2xl md:text-3xl text-base-dark leading-tight relative z-10">
                  &quot;Ein gutes Festl plant sich nicht von allein, aber es soll sich so anfühlen.&quot;
                </p>
              </div>
              
              <p className="text-base text-base-dark/70">
                Lass uns gemeinsam ein Event auf die Beine stellen, das deinen Gästen noch lange in bester Erinnerung bleibt.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
