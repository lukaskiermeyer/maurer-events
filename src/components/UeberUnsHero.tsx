"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function UeberUnsHero() {
  const t = useTranslations("About");

  return (
    <section id="ueber-uns-intro" className="relative overflow-hidden bg-canvas-light text-base-dark">
      {/* Warmer, persönlicher Hintergrund */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full bg-accent-green/8 blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-accent-wood/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-[300px] h-[300px] rounded-full bg-accent-green/5 blur-2xl" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-7"
          >
            <div className="mb-6">
              <Image
                src="/Icon_MaurerGrün.svg"
                alt=""
                width={192}
                height={192}
                className="w-32 h-32 md:w-48 md:h-48 mb-2 opacity-90"
                aria-hidden="true"
              />
              <p className="font-sans text-sm font-bold uppercase tracking-[0.3em] text-accent-green mb-6">
                {t("subtitle")}
              </p>
            </div>
            <h1 className="font-display font-black text-6xl md:text-8xl leading-[0.95] mb-8">
              {t('hero_greeting')}
            </h1>
            <p className="font-sans text-xl md:text-2xl text-base-dark/70 max-w-2xl leading-relaxed">
              {t('hero_intro')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="lg:col-span-5"
          >
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-accent-green/40 to-accent-wood/40 border border-white/10 shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display font-black text-8xl text-white/20 select-none">ME</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p className="font-script text-3xl text-white/90 rotate-[-3deg] inline-block">Da Maurerwirt</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mittlerer Text: Team */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center mb-16 md:mb-24"
        >
          <p className="font-sans text-xl md:text-2xl text-base-dark/80 leading-relaxed">
            {t('hero_team')}
          </p>
        </motion.div>

        <div className="text-center">
          <Link
            href="/#contact"
            className="inline-flex items-center gap-3 bg-accent-green text-white px-8 py-4 rounded-full font-display font-bold uppercase tracking-wide text-sm shadow-lg hover:bg-white hover:text-accent-green transition-colors"
          >
            {t("cta")}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}