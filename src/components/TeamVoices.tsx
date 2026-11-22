"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

export type TeamVoice = {
  name: string;
  role: string;
  quote: string;
  spruch: string;
  image?: string;
};

const QUOTE_PATH =
  "M9.6 6C5.2 8.6 2.6 12.4 2.6 17.2c0 4.6 2.8 7.8 6.6 7.8 3.2 0 5.6-2.4 5.6-5.6 0-3-2.2-5.2-5.2-5.2-.6 0-1.2.1-1.6.2.4-2.6 2.2-5 4.8-6.6L9.6 6zm14 0c-4.4 2.6-7 6.4-7 11.2 0 4.6 2.8 7.8 6.6 7.8 3.2 0 5.6-2.4 5.6-5.6 0-3-2.2-5.2-5.2-5.2-.6 0-1.2.1-1.6.2.4-2.6 2.2-5 4.8-6.6L23.6 6z";

// Stimmen aus dem Team als Karten-Carousel (Skizze: 3 Karten nebeneinander,
// Pfeile links/rechts, darunter das Teamfoto als breites Banner).
export default function TeamVoices({
  voices,
  children,
}: {
  voices: TeamVoice[];
  children?: React.ReactNode;
}) {
  const t = useTranslations("UeberUns");
  const reduced = useReducedMotion();
  const [perView, setPerView] = useState(1);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const lg = window.matchMedia("(min-width: 1024px)");
    const md = window.matchMedia("(min-width: 640px)");
    const update = () => setPerView(lg.matches ? 3 : md.matches ? 2 : 1);
    update();
    lg.addEventListener("change", update);
    md.addEventListener("change", update);
    return () => {
      lg.removeEventListener("change", update);
      md.removeEventListener("change", update);
    };
  }, []);

  const maxIndex = Math.max(0, voices.length - perView);
  const current = Math.min(index, maxIndex);
  const step = 100 / perView;

  const arrow = (dir: -1 | 1, extra: string) => (
    <button
      type="button"
      onClick={() => setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)))}
      disabled={dir === -1 ? current === 0 : current === maxIndex}
      aria-label={dir === -1 ? t("prev") : t("next")}
      className={`w-12 h-12 rounded-full border-2 border-base-dark bg-base-light text-base-dark flex items-center justify-center transition-colors hover:bg-accent-green hover:text-white hover:border-accent-green disabled:opacity-30 disabled:pointer-events-none shadow-md ${extra}`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === -1 ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );

  return (
    <>
      <section id="team-stimmen" className="bg-canvas-light py-24 md:py-32 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center mb-14"
          >
            <p className="font-sans text-sm font-bold uppercase tracking-widest text-accent-green mb-4">{t("eyebrow")}</p>
            <h2 className="font-display font-bold text-4xl md:text-6xl text-base-dark mb-4">{t("headline")}</h2>
            <p className="font-sans text-lg text-base-dark/70 font-medium max-w-2xl mx-auto">{t("subline")}</p>
          </motion.div>

          <div className="relative">
            {arrow(-1, "hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10")}
            {arrow(1, "hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10")}

            <div className="overflow-hidden">
              <motion.div
                className="flex"
                animate={{ x: `-${current * step}%` }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
              >
                {voices.map((v) => (
                  <div key={v.name} className="shrink-0 px-3 pb-2" style={{ width: `${step}%` }}>
                    <div
                      className="group relative w-full aspect-square [perspective:1000px]"
                    >
                      <div
                        className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]"
                      >
                        {/* Vorderseite: Vollbild-Bild mit Name & Position */}
                        <div className="absolute inset-0 [backface-visibility:hidden] rounded-3xl overflow-hidden shadow-lg">
                          {v.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-accent-green to-accent-green-deep flex items-center justify-center">
                              <span className="font-display font-black text-6xl md:text-7xl text-white/90 select-none" aria-hidden="true">
                                {v.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-5">
                            <span className="block font-display font-bold text-lg md:text-xl text-white">{v.name}</span>
                            <span className="block text-xs font-bold uppercase tracking-widest text-white/80">{v.role}</span>
                          </div>
                        </div>
                        {/* Rueckseite: lustiger Spruch */}
                        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl overflow-hidden shadow-lg bg-accent-green-deep text-white flex items-center justify-center p-6">
                          <p className="font-script text-2xl md:text-3xl text-center leading-snug">„{v.spruch}“</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <span className="lg:hidden">{arrow(-1, "")}</span>
              <div className="flex items-center gap-2">
                {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`${i + 1}`}
                    aria-current={i === current}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${i === current ? "bg-accent-green" : "bg-base-dark/20 hover:bg-base-dark/40"}`}
                  />
                ))}
              </div>
              <span className="lg:hidden">{arrow(1, "")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-accent-green py-20 md:py-24">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="relative aspect-[21/9] rounded-3xl overflow-hidden border-2 border-black shadow-xl bg-canvas-light">
              {children}
            </div>

          </motion.div>
        </div>
      </section>
    </>
  );
}
