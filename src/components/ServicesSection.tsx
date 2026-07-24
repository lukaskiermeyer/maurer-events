"use client";

import { motion } from "framer-motion";
import { services } from "@/data/services";

// Ultra-minimalist traditional SVGs (Thin line art)
const Icons = {
  beer: (props: any) => (
    // Maßkrug / Beer
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 22h8v-16h-8v16z" />
      <path d="M15 10h3v7h-3" />
      <path d="M7 6v-2h8v2" />
      <line x1="10" y1="9" x2="10" y2="19" />
      <line x1="12" y1="9" x2="12" y2="19" />
    </svg>
  ),
  briefcase: (props: any) => (
    // Festzelt / Tent / Business
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4l-10 16h20z" />
      <path d="M12 4v16" />
      <path d="M8 11l4 9" />
      <path d="M16 11l-4 9" />
    </svg>
  ),
  users: (props: any) => (
    // Brezel / Community
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 15c-3 0-5-2-5-5s3-5 5-5 5 2 5 5-2 5-5 5z" />
      <path d="M12 15c0 3-2 5-5 5s-5-2-5-5 3-5 5-5" />
      <path d="M12 15c0 3 2 5 5 5s5-2 5-5-3-5-5-5" />
    </svg>
  ),
  sun: (props: any) => (
    // Edelweiss / Outdoor
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9l-2-6 2 2 2-2-2 6z" />
      <path d="M12 15l-2 6 2-2 2 2-2-6z" />
      <path d="M9 12l-6-2 2 2-2 2 6-2z" />
      <path d="M15 12l6-2-2 2 2 2-6-2z" />
    </svg>
  )
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function ServicesSection() {
  return (
    <section id="services" className="py-24 bg-accent-green text-base-light relative overflow-hidden border-t border-base-dark">
      {/* Easter Egg Figure peeking from left */}
      <motion.div 
        initial={{ x: -100, opacity: 0 }}
        whileInView={{ x: -10, opacity: 0.15 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="absolute top-40 -left-10 w-64 pointer-events-none hidden lg:block"
      >
        <img src="/figur-transparent.png" alt="Festwirt Easteregg" className="w-full h-auto drop-shadow-2xl" />
      </motion.div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
          <div className="max-w-2xl">
            <motion.h2 
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-black text-5xl md:text-7xl mb-4 text-base-light"
            >
              Unsere Services
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-sans text-xl text-base-light/80 max-w-md"
            >
              Maßgeschneidert für jeden Anlass. Präzision trifft auf bayerische Herzlichkeit.
            </motion.p>
          </div>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {services.map((service: any) => {
            const Icon = Icons[service.iconType as keyof typeof Icons];
            return (
              <motion.div
                key={service.id}
                variants={itemVariants}
                className="group relative bg-canvas-light text-base-dark p-8 rounded-3xl shadow-lg border-b-8 border-accent-wood transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-accent-wood overflow-hidden"
              >
                <div className="relative z-10 flex flex-col h-full">
                  <div>
                    <div className="text-accent-wood mb-8 bg-accent-wood/15 w-16 h-16 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300">
                      {Icon && <Icon className="w-8 h-8" />}
                    </div>
                    <h4 className="font-display font-bold text-2xl mb-3">{service.title}</h4>
                  </div>
                  <p className="font-sans text-base-dark/70 text-base leading-relaxed mt-4">
                    {service.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
