"use client";

import type { SVGProps } from "react";

import { motion } from "framer-motion";
import { useState } from "react";
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
  // Herz (Zusammenhalt)
  (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  ),
];

const COASTER_TILT = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3"];

// "Unser Anspruch" als Wirtshaus-Tisch: persoenlicher Brief im Hero, die Werte
// als gestempelte Bierdeckel auf Holz, dazu ein handgeschriebenes Fest-Rezept.
export default function IdentitySection() {
  const t = useTranslations("Identity");
  const values = t.raw("values") as Value[];
  const recipeItems = t.raw("recipe_items") as string[];
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <>
      {/* Hero wie ein persoenlicher Brief auf Papier */}
      <section className="pt-32 md:pt-40 pb-16 md:pb-24 bg-canvas-light relative overflow-hidden">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 text-center relative">
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
            className="font-display font-bold text-6xl md:text-8xl text-accent-green leading-tight mb-8 -rotate-2"
          >
            {t("title_2").split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-base-dark italic">{t("title_2").split(" ").slice(-1)}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="font-subhead text-xl md:text-2xl leading-relaxed text-base-dark/80"
          >
            {t("intro")}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="font-script text-3xl md:text-4xl text-base-dark/70 mt-8 rotate-[-1deg]"
          >
            {t("signature")}
            <svg className="inline-block w-7 h-7 ml-2 text-accent-wood align-middle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </motion.p>
        </div>
      </section>

      {/* Werte als Bierdeckel auf dem Holztisch */}
      <section className="py-20 md:py-28 bg-wood relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8 items-center">
            {values.map((value, index) => {
              const Icon = Icons[index % Icons.length];
              const themes = [
                { bg: "bg-accent-green", border: "border-accent-green/40", icon: "text-accent-green", iconBg: "bg-accent-green/10" },
                { bg: "bg-accent-wood", border: "border-accent-wood/40", icon: "text-accent-wood", iconBg: "bg-accent-wood/10" },
                { bg: "bg-base-dark", border: "border-base-dark/40", icon: "text-base-dark", iconBg: "bg-base-dark/10" },
                { bg: "bg-accent-green-deep", border: "border-accent-green-deep/40", icon: "text-accent-green-deep", iconBg: "bg-accent-green-deep/10" },
              ];
              const theme = themes[index % themes.length];
              const paperStyle = {
                backgroundImage:
                  "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, transparent 60%), repeating-radial-gradient(circle at 0 0, rgba(110,80,40,0.05) 0px, rgba(110,80,40,0.05) 1px, transparent 1px, transparent 3px)",
                backgroundColor: "#f1e9da",
                boxShadow:
                  "inset 0 3px 10px rgba(90,60,30,0.12), inset 0 -2px 6px rgba(90,60,30,0.08), 0 14px 32px rgba(0,0,0,0.22)",
              };
              const isFlipped = flipped === index;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 40, rotate: 0 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: (index % 4) * 0.12 }}
                  className={`relative aspect-square [perspective:1000px] ${COASTER_TILT[index % 4]}`}
                >
                  <div
                    onClick={() => setFlipped(isFlipped ? null : index)}
                    className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] cursor-pointer group ${isFlipped ? "[transform:rotateY(180deg)]" : ""} group-hover:[transform:rotateY(180deg)]`}
                  >
                    {/* Vorderseite: Icon + Titel */}
                    <div
                      className="absolute inset-0 [backface-visibility:hidden] rounded-full flex items-center justify-center p-6 md:p-8 overflow-hidden"
                      style={paperStyle}
                    >
                      <div className={`absolute inset-4 rounded-full border-4 ${theme.border} pointer-events-none`} />
                      <div className="relative text-center flex flex-col items-center gap-3 max-w-[75%]">
                        <span className={`w-12 h-12 rounded-full ${theme.iconBg} ${theme.icon} flex items-center justify-center shrink-0`}>
                          <Icon className="w-6 h-6" />
                        </span>
                        <h2 className="font-display font-bold text-lg md:text-xl text-base-dark leading-tight break-words">{value.title}</h2>
                      </div>
                    </div>
                    {/* Rueckseite: Männchen + Text */}
                    <div
                      className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-full flex items-center justify-center p-6 md:p-8 overflow-hidden"
                      style={paperStyle}
                    >
                      <div className={`absolute inset-4 rounded-full border-4 ${theme.border} pointer-events-none`} />
                      <div className="relative text-center flex flex-col items-center gap-2 max-w-[70%]">
                        <div
                          className={`w-14 h-14 md:w-16 md:h-16 ${theme.bg} shrink-0`}
                          style={{
                            maskImage: "url(/Icon_MaurerGrün.svg)",
                            WebkitMaskImage: "url(/Icon_MaurerGrün.svg)",
                            maskSize: "contain",
                            WebkitMaskSize: "contain",
                            maskRepeat: "no-repeat",
                            WebkitMaskRepeat: "no-repeat",
                            maskPosition: "center",
                            WebkitMaskPosition: "center",
                          }}
                          aria-hidden="true"
                        />
                        <p className="font-sans text-xs md:text-sm text-base-dark leading-snug break-words">{value.text}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Handgeschriebenes Fest-Rezept auf geklebtem Papier */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative max-w-2xl mx-auto mt-16 md:mt-24 bg-base-light shadow-2xl p-8 md:p-12 rotate-[-1.5deg]"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#E5DCC5]/80 backdrop-blur-sm rotate-[2deg] shadow-sm" />
            <h2 className="font-subhead text-4xl md:text-5xl text-accent-green mb-6 text-center -rotate-1">{t("recipe_title")}</h2>
            <ul className="space-y-3 max-w-md mx-auto">
              {recipeItems.map((item) => (
                <li key={item} className="flex items-start gap-3 font-subhead text-lg md:text-xl text-base-dark/80">
                  <svg className="w-5 h-5 mt-1 shrink-0 text-accent-wood" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="font-script text-2xl md:text-3xl text-base-dark/70 text-center mt-8 rotate-[1deg]">{t("recipe_note")}</p>
          </motion.div>

          {/* Partner als handschriftliche Notiz */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative max-w-xl mx-auto mt-12 bg-base-light/95 shadow-xl p-6 md:p-8 rotate-[1deg] text-center"
          >
            <div className="absolute -top-3 left-8 w-20 h-5 bg-[#E5DCC5]/80 backdrop-blur-sm rotate-[-3deg] shadow-sm" />
            <h2 className="font-display font-bold text-xl md:text-2xl text-base-dark mb-2">
              {t("partners_title").split(" ").slice(0, -1).join(" ")}{" "}
              <span className="text-accent-green italic">{t("partners_title").split(" ").slice(-1)}</span>
            </h2>
            <p className="font-sans text-sm md:text-base text-base-dark/60">{t("partners_text")}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-accent-green text-center">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 lg:px-16">
          <Link
            href="/#contact"
            className="inline-flex items-center gap-3 bg-white text-base-dark px-10 py-5 rounded-full font-display font-bold uppercase tracking-wide text-sm md:text-base shadow-lg hover:bg-accent-green-deep hover:text-white transition-colors"
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
