"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { CareerContent } from "@/types/domain";

export default function CareersTeaser({ content, children }: { content: CareerContent; children?: React.ReactNode }) {
  const t = useTranslations("CareersTeaser");
  const positions = content.positions;

  return (
    <section id="karriere-teaser" className="relative bg-canvas-light py-20 md:py-28 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-accent-green mb-4">
            {t("eyebrow")}
          </p>
          <h2 className="font-display font-bold text-5xl md:text-7xl leading-[1.05] mb-4 text-base-dark">
            {content.headline.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-accent-green italic">{content.headline.split(" ").slice(-1)}</span>
          </h2>
          <p className="font-sans text-lg text-base-dark/70 font-medium max-w-xl mb-6">
            {content.intro}
          </p>


          {positions.length > 0 ? (
            <ul className="mb-10 divide-y divide-base-dark/10 border-y border-base-dark/10">
              {positions.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <Link href="/karriere" className="group flex items-center justify-between gap-4 py-4">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-3">
                        <span className="font-display font-bold text-lg text-base-dark group-hover:text-accent-green transition-colors">
                          {job.title}
                        </span>
                        {job.badge && (
                          <span className="bg-accent-gold text-base-dark text-[10px] font-black uppercase px-2 py-1 rounded">
                            {job.badge}
                          </span>
                        )}
                      </span>
                      {job.employment && (
                        <span className="block text-sm font-bold text-base-dark/60 mt-0.5">
                          {job.employment}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-2 bg-accent-green text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full group-hover:bg-accent-green/80 transition-colors shadow-sm">
                      {t("cta_row")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-10 font-sans text-base-dark/70">
              {t("empty_hint")}
            </p>
          )}

          <div className="flex flex-wrap gap-4">
            <Link href="/karriere" className="inline-flex items-center gap-3 bg-accent-green text-white px-8 py-4 rounded-full font-display font-bold uppercase tracking-wide hover:bg-accent-green/80 transition-colors text-sm shadow-md">
              {positions.length > 0 ? t("cta_positions") : t("cta_apply")}
            </Link>
          </div>
        </motion.div>

        {/* Gruppenfoto als Fokus, gerahmt wie ein Polaroid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="relative bg-white p-3 pb-14 rounded-xl shadow-2xl rotate-[-2deg]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-canvas-light">
              {children}
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
