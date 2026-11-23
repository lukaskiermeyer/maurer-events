"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/routing";

// Gerade Lichterkette als Section-Abtrennung: gleichmaessig verteilte Birnen an
// einer horizontalen Linie (kein Durchhang). Die Wrapper-Schriftgroesse spiegelt
// die Headline (text-5xl md:text-7xl); alle Masse sind em-basiert (Referenz 72px
// = Headline ab md), damit die Birnen immer das gleiche Groessenverhaeltnis zum
// Text haben. Auf kleinen Screens weniger Birnen (count), damit die Abstaende
// nicht zu eng werden. Dunkle Kontur, warmer Glaskoerper, weissheisser Kern.
function Garland({ count, className }: { count: number; className?: string }) {
  const reduced = useReducedMotion();
  const positions = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * 100);
  return (
    <div
      className={`pointer-events-none absolute left-0 w-full text-5xl md:text-7xl ${className ?? ""}`}
      style={{ height: "calc(80em / 72)" }}
      aria-hidden="true"
    >
      {/* Lichtschein der Birnen: eigene Ebene mit Screen-Blend, damit die Lampen
          den Grund ringsum aufhellen. Gleiche Positionen und Groessen wie die
          Birnen, damit die Lichtkegel exakt unter den Birnen sitzen. */}
      <div className="absolute inset-0" style={{ mixBlendMode: "screen" }}>
        {/* Sanftes, gestaffeltes Pulsieren der Lichtkegel; Reduced Motion statisch. */}
        {positions.map((left, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              top: "calc(33em / 72)",
              width: "calc(90em / 72)",
              height: "calc(90em / 72)",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,226,160,0.3) 0%, rgba(255,206,120,0.11) 55%, rgba(255,206,120,0) 100%)",
            }}
            animate={reduced ? { opacity: 0.8 } : { opacity: [0.5, 1, 0.5] }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 3.2 + (i % 4) * 0.6, delay: i * 0.35, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}
      </div>
      <div
        className="absolute left-0 right-0"
        style={{ top: "calc(16.5em / 72)", height: "calc(3em / 72)", backgroundColor: "rgba(250,248,244,0.4)" }}
      />
      {positions.map((left, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: `${left}%`, top: "calc(16em / 72)", transform: "translateX(-50%)" }}
        >
          <div
            className="mx-auto"
            style={{ width: "calc(7em / 72)", height: "calc(9em / 72)", borderRadius: "calc(1.5em / 72)", backgroundColor: "rgba(250,248,244,0.6)" }}
          />
          <div className="relative rounded-full" style={{ width: "calc(16em / 72)", height: "calc(16em / 72)", backgroundColor: "#0A0A0A" }}>
            <div className="absolute rounded-full" style={{ inset: "calc(2em / 72)", backgroundColor: "#E9B44C" }} />
            <div
              className="absolute rounded-full"
              style={{ left: "calc(3.7em / 72)", top: "calc(3.7em / 72)", width: "calc(5.6em / 72)", height: "calc(5.6em / 72)", backgroundColor: "#FFF6DC" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AboutSection() {
  const t = useTranslations("About");

  return (
      <section id="about" className="py-24 md:py-32 bg-accent-green-deep border-t border-white/10 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          {/* Unter md (Headline text-5xl): 6 Birnen; ab md (text-7xl): 12. */}
          <Garland count={6} className="top-0 md:hidden" />
          <Garland count={12} className="top-0 hidden md:block" />
        </div>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-center">

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="lg:col-span-5 relative"
            >
              <h2 className="font-display font-bold text-5xl md:text-7xl text-base-light leading-[1.1] mb-12 relative z-20">
                {t("title_1_alt")} <br/><span className="text-accent-gold italic">{t("title_2_alt")}</span>
              </h2>

              {/* Bild Container - clean und analog */}
              <div className="relative max-w-sm mx-auto lg:mx-0 group">

                {/* Polaroid Style Bild */}
                <div className="relative z-10 bg-white p-4 pb-16 shadow-2xl transform rotate-[-2deg] transition-transform duration-500 group-hover:rotate-0">
                  {/* Fake Klebestreifen (Tape) oben */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#E5DCC5]/80 backdrop-blur-sm rotate-[3deg] shadow-sm"></div>

                  <Image
                      src="/florian.jpg"
                      alt="Florian Maurer - Festwirt"
                      width={600}
                      height={800}
                      sizes="(max-width: 639px) min(22rem, calc(100vw - 4rem)), 22rem"
                      quality={70}
                      className="w-full h-auto object-cover grayscale-[10%] contrast-110" // Leicht analoger Foto-Look
                  />

                  {/* Handgeschriebener Text auf dem Polaroid */}
                  <div className="absolute bottom-4 left-0 w-full text-center">
                    <span 
                      className="font-script text-3xl text-base-dark/80 opacity-90 rotate-[-4deg] inline-block tracking-wide"
                    >
                      Da Maurerwirt
                    </span>
                  </div>
                </div>

              </div>
            </motion.div>

            {/* Rechter Bereich: Text & Zitat */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="lg:col-span-6 lg:col-start-7 pt-12 lg:pt-0"
            >
              <h3 className="font-sans text-sm md:text-base text-base-light/80 font-bold uppercase tracking-widest mb-8">
                {t("subtitle")}
              </h3>

              <div className="space-y-6 font-sans text-lg md:text-xl text-base-light/80 leading-relaxed">
                <p>
                  {t("p1")}
                </p>
                <p>
                  {t("p2")}
                </p>

                {/* Organisches, wuchtiges Zitat */}
                <div className="relative my-16 py-4">
                  {/* Großes SVG Anführungszeichen im Hintergrund */}
                  <svg className="absolute -top-6 -left-8 w-24 h-24 text-accent-gold opacity-50 transform -rotate-6" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                  </svg>

                  <p className="font-display font-black text-3xl md:text-4xl text-base-light leading-tight relative z-10 pl-4 md:pl-0">
                    {t("quote")}
                  </p>
                </div>

                <p className="text-base md:text-lg text-base-light/70">
                  {t("p3")}
                </p>

                <div className="pt-4">
                  <Link
                    href="/#contact"
                    className="inline-flex items-center gap-3 bg-accent-gold text-base-dark px-8 py-4 rounded-full font-display font-bold uppercase tracking-wide text-sm shadow-lg hover:bg-white hover:text-accent-green-deep transition-colors"
                  >
                    {t("cta")}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
  );
}