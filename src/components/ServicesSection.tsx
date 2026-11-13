"use client";
import Image from 'next/image';

import type { SVGProps } from 'react';
import { useState, useEffect } from 'react';

import { motion, AnimatePresence, Variants } from "framer-motion";
import { services } from "@/data/services";
import { useTranslations } from "next-intl";

// Ultra-minimalist traditional SVGs (Thin line art)
const Icons = {
  beer: (props: SVGProps<SVGSVGElement>) => (
    // Maßkrug / Beer (Chunky, cartoon style)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 8v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path d="M17 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
      <path d="M6 8c-1.5 0-2-1.5-2-2.5S5.5 3 7 3c1 0 1.5.5 2.5 1 1.5 0 2.5-1 4-1s2 .5 3 1c1-.5 1.5-1 2.5-1s3 1.5 3 2.5S21 8 20 8H6z" fill="currentColor" fillOpacity="0.15" />
      <line x1="10" y1="12" x2="10" y2="18" />
      <line x1="14" y1="12" x2="14" y2="18" />
    </svg>
  ),
  briefcase: (props: SVGProps<SVGSVGElement>) => (
    // Briefcase (Chunky)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="18" height="14" rx="2" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 12v.01" strokeWidth="4" />
      <path d="M3 12h18" />
    </svg>
  ),
  users: (props: SVGProps<SVGSVGElement>) => (
    // Festzelt (Chunky Tent for Vereinsfest)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21h18L12 5 3 21z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 5V2l4 1.5L12 5z" fill="currentColor" />
      <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
    </svg>
  ),
  sun: (props: SVGProps<SVGSVGElement>) => (
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ vereinsfest: true });
  const [isLg, setIsLg] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false));

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section id="services" className="py-16 sm:py-20 lg:py-24 bg-accent-green text-base-light relative overflow-hidden border-t-4 border-base-dark">

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">

        <div className="flex flex-row items-start md:items-center justify-between mb-12 sm:mb-16 lg:mb-20 gap-4 md:gap-8">

          <div className="max-w-2xl min-w-0 relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] break-words mb-4 text-base-light"
            >
              {t("title")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-sans text-lg sm:text-xl text-base-light/80 max-w-md"
            >
              {t("subtitle")}
            </motion.p>
          </div>

          {/* Männchen rechts von der Überschrift, als eigene Spalte im Flex-Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="shrink-0 w-20 sm:w-40 lg:w-56 pointer-events-none"
          >
            <Image src="/maennchen.svg" alt="Festwirt Icon" width={241} height={205} className="w-full h-auto brightness-0 invert opacity-20 drop-shadow-md" />
          </motion.div>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-5 md:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {services.map((service, index) => {
            const Icon = Icons[service.iconType as keyof typeof Icons];
            const featured = service.featured === true;
            const isBig = index === 0;
            const isOpen = isLg || expanded[service.id] === true;
            return (
              <motion.div
                key={service.id}
                variants={itemVariants}
                className={`group relative min-w-0 h-full rounded-3xl shadow-lg border-b-8 border-accent-wood bg-white text-base-dark transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 overflow-hidden ${
                  featured
                    ? `sm:col-span-2 lg:col-span-1 ${isBig ? "lg:row-span-2 " : ""}p-4 sm:p-6 md:p-8`
                    : "p-4 sm:p-5"
                }`}
              >
                <div className="relative z-10 min-w-0">
                  <button
                    type="button"
                    onClick={() => { if (!isLg) toggle(service.id); }}
                    aria-expanded={isOpen}
                    aria-controls={`service-desc-${service.id}`}
                    className="flex w-full items-center gap-4 text-left cursor-pointer"
                  >
                    <span className={`shrink-0 text-accent-gold bg-accent-gold/15 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300 ${
                      featured ? "w-12 h-12 md:w-16 md:h-16" : "w-10 h-10 md:w-12 md:h-12"
                    }`}>
                      {Icon && <Icon className={featured ? "w-6 h-6 md:w-8 md:h-8" : "w-5 h-5 md:w-6 md:h-6"} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold text-xl sm:text-2xl md:text-3xl leading-tight break-words hyphens-auto">{t(`items.${service.id}.title`)}</span>
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="shrink-0 text-accent-wood lg:hidden"
                      aria-hidden="true"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`service-desc-${service.id}`}
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="font-sans text-base md:text-lg leading-snug md:leading-relaxed break-words hyphens-auto text-base-dark/70 pt-3">
                          {t(`items.${service.id}.description`)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
