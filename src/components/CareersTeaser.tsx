"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { CareerContent } from "@/types/domain";

export default function CareersTeaser({ content }: { content: CareerContent }) {
  const t = useTranslations("CareersTeaser");
  const positions = content.positions;

  return (
    <section id="karriere-teaser" className="relative bg-accent-green border-t-4 border-base-dark py-20 md:py-28 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-[#EDBE6A] mb-4">
            {t("eyebrow")}
          </p>
          <h2 className="font-display font-bold text-5xl md:text-7xl leading-[1.05] mb-4 text-base-light">
            {content.headline}
          </h2>
          <p className="font-sans text-lg text-base-light/75 font-medium max-w-xl mb-8">
            {content.intro}
          </p>

          {positions.length > 0 ? (
            <ul className="mb-10 divide-y divide-white/20 border-y border-white/20">
              {positions.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <Link href="/karriere" className="group flex items-center justify-between gap-4 py-4">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-3">
                        <span className="font-display font-bold text-lg text-base-light group-hover:text-[#EDBE6A] transition-colors">
                          {job.title}
                        </span>
                        {job.badge && (
                          <span className="bg-accent-gold text-base-dark text-[10px] font-black uppercase px-2 py-1 rounded">
                            {job.badge}
                          </span>
                        )}
                      </span>
                      {job.employment && (
                        <span className="block text-sm font-bold text-base-light/60 mt-0.5">
                          {job.employment}
                        </span>
                      )}
                    </span>
                    <svg className="w-5 h-5 shrink-0 text-accent-gold transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-10 font-sans text-base-light/75">
              {t("empty_hint")}
            </p>
          )}

          <div className="flex flex-wrap gap-4">
            <Link href="/karriere" className="inline-flex items-center gap-3 bg-white text-base-dark px-8 py-4 rounded-full font-display font-bold uppercase tracking-wide hover:bg-base-dark hover:text-white transition-colors text-sm shadow-sm">
              {positions.length > 0 ? t("cta_positions") : t("cta_apply")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </motion.div>

        {/* Arbeitskleidung als Fokus, gerahmt wie ein Polaroid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="relative mx-auto w-full max-w-sm"
        >
          <div className="relative bg-white p-3 pb-14 rounded-xl shadow-2xl rotate-[-2deg]">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
              <Image
                src="/Kleidung.svg"
                alt="Klassische Arbeitskleidung: Schwarzes Oversized-T-Shirt mit Maurer-Logo, grüne Cap und schwarze Schürze"
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-cover"
              />
            </div>
            <p className="absolute bottom-4 left-0 w-full text-center">
              <span
                className="text-2xl text-base-dark/80 opacity-90 rotate-[-4deg] inline-block tracking-wide"
                style={{ fontFamily: "'Dancing Script', 'Caveat', 'Brush Script MT', 'Lucida Handwriting', cursive" }}
              >
                {t("caption")}
              </span>
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
