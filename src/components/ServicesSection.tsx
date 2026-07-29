"use client";

import { motion, Variants } from "framer-motion";
import { services } from "@/data/services";
import { useTranslations } from "next-intl";

// Ultra-minimalist traditional SVGs (Thin line art)
const Icons = {
  beer: (props: any) => (
    // Maßkrug / Beer (Chunky, cartoon style)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 8v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path d="M17 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
      <path d="M6 8c-1.5 0-2-1.5-2-2.5S5.5 3 7 3c1 0 1.5.5 2.5 1 1.5 0 2.5-1 4-1s2 .5 3 1c1-.5 1.5-1 2.5-1s3 1.5 3 2.5S21 8 20 8H6z" fill="currentColor" fillOpacity="0.15" />
      <line x1="10" y1="12" x2="10" y2="18" />
      <line x1="14" y1="12" x2="14" y2="18" />
    </svg>
  ),
  briefcase: (props: any) => (
    // Briefcase (Chunky)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="18" height="14" rx="2" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 12v.01" strokeWidth="4" />
      <path d="M3 12h18" />
    </svg>
  ),
  users: (props: any) => (
    // Festzelt (Chunky Tent for Vereinsfest)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21h18L12 5 3 21z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 5V2l4 1.5L12 5z" fill="currentColor" />
      <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
    </svg>
  ),
  sun: (props: any) => (
    // Sun (Chunky)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.15" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4" y1="12" x2="2" y2="12" />
      <line x1="22" y1="12" x2="20" y2="12" />
      <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
      <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
      <line x1="19.07" y1="19.07" x2="17.66" y2="17.66" />
      <line x1="6.34" y1="6.34" x2="4.93" y2="4.93" />
    </svg>
  )
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function ServicesSection() {
  const t = useTranslations("Services");

  return (
    <section id="services" className="py-24 bg-accent-green text-base-light relative overflow-hidden border-t border-base-dark">

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-20 gap-8">

          <div className="max-w-2xl relative z-10">
            {/* Easter Egg Icon positioned absolutely to the left so it doesn't shift the text */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute top-4 md:top-6 lg:top-8 right-full mr-0 md:mr-2 lg:mr-4 w-24 md:w-32 lg:w-40 pointer-events-none hidden sm:block z-0"
            >
              <img src="/maennchen.svg" alt="Festwirt Icon" className="w-full h-auto brightness-0 invert opacity-15 drop-shadow-md" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-black text-5xl md:text-7xl mb-4 text-base-light"
            >
              {t("title")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-sans text-xl text-base-light/80 max-w-md"
            >
              {t("subtitle")}
            </motion.p>
          </div>
        </div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
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
                className="group relative bg-canvas-light text-base-dark p-5 md:p-8 rounded-3xl shadow-lg border-b-8 border-accent-wood transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-accent-wood overflow-hidden"
              >
                <div className="relative z-10 flex flex-col h-full">
                  <div>
                    <div className="text-accent-gold mb-4 md:mb-8 bg-accent-gold/15 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300">
                      {Icon && <Icon className="w-6 h-6 md:w-8 md:h-8" />}
                    </div>
                    <h4 className="font-display font-bold text-base md:text-2xl mb-2 md:mb-3 leading-tight break-words hyphens-auto">{t(`items.${service.id}.title`)}</h4>
                  </div>
                  <p className="font-sans text-base-dark/70 text-xs sm:text-sm md:text-base leading-snug md:leading-relaxed mt-2 md:mt-4 break-words hyphens-auto">
                    {t(`items.${service.id}.description`)}
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
