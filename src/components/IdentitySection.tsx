"use client";

import type { SVGProps } from "react";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type Value = { title: string; text: string };

const Icons = [
  // Blatt (Bio & Qualität)
  (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  // Karte (Regionalität)
  (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  // Maßkrug (Handwerk & Tradition)
  (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 8v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path d="M17 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
      <path d="M6 8c-1.5 0-2-1.5-2-2.5S5.5 3 7 3c1 0 1.5.5 2.5 1 1.5 0 2.5-1 4-1s2 .5 3 1c1-.5 1.5-1 2.5-1s3 1.5 3 2.5S21 8 20 8H6z" />
      <line x1="10" y1="12" x2="10" y2="18" />
      <line x1="14" y1="12" x2="14" y2="18" />
    </svg>
  ),
  // Hände/Herz (Zusammenhalt)
  (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  ),
];

export default function IdentitySection() {
  const t = useTranslations("Identity");
  const values = t.raw("values") as Value[];

  return (
    <>
      <section className="pt-32 md:pt-40 pb-20 md:pb-28 bg-base-light relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-sans text-sm font-bold uppercase tracking-widest text-accent-green mb-6"
          >
            {t("eyebrow")}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display font-bold text-5xl md:text-7xl leading-[1.05] text-base-dark mb-10"
          >
            {t("title_1")} <br />
            <span className="text-accent-green">{t("title_2")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="font-subhead text-2xl md:text-4xl leading-snug text-base-dark/80 max-w-4xl"
          >
            {t("intro")}
          </motion.p>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-canvas-light">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {values.map((value, index) => {
              const Icon = Icons[index % Icons.length];
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: (index % 2) * 0.12 }}
                  className="bg-white rounded-3xl border border-border-light shadow-sm p-8 md:p-10 flex gap-6"
                >
                  <span className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-green/10 text-accent-green flex items-center justify-center">
                    <Icon className="w-7 h-7 md:w-8 md:h-8" />
                  </span>
                  <div>
                    <h2 className="font-display font-bold text-xl md:text-2xl text-base-dark mb-3">{value.title}</h2>
                    <p className="font-sans text-base md:text-lg text-base-dark/70 leading-relaxed">{value.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 md:mt-16 rounded-3xl border border-border-light bg-white/60 p-8 md:p-12 text-center"
          >
            <h2 className="font-display font-bold text-2xl md:text-3xl text-base-dark mb-3">{t("partners_title").split(" ").slice(0, -1).join(" ")}{" "}<span className="text-accent-green italic">{t("partners_title").split(" ").slice(-1)}</span></h2>
            <p className="font-sans text-base md:text-lg text-base-dark/60 max-w-2xl mx-auto">{t("partners_text")}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-accent-green text-center">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 lg:px-16">
          <Link
            href="/#contact"
            className="inline-flex items-center gap-3 bg-white text-base-dark px-10 py-5 rounded-full font-display font-bold uppercase tracking-wide text-sm md:text-base shadow-lg hover:bg-accent-green/80 hover:text-white transition-colors"
          >
            {t("cta")}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
