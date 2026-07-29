"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function AboutSection() {
  const t = useTranslations("About");

  return (
      <section id="about" className="py-24 md:py-32 bg-base-light border-t border-base-dark overflow-hidden relative">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-center">

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="lg:col-span-5 relative"
            >
              <h2 className="font-display font-bold text-5xl md:text-7xl text-base-dark leading-[1.1] mb-12 relative z-20">
                {t("title_1_alt")} <br/><span className="text-accent-green">{t("title_2_alt")}</span>
              </h2>

              {/* Bild Container - clean und analog */}
              <div className="relative max-w-sm mx-auto lg:mx-0 group">

                {/* Polaroid Style Bild */}
                <div className="relative z-10 bg-white p-4 pb-16 shadow-2xl transform rotate-[-2deg] transition-transform duration-500 group-hover:rotate-0">
                  {/* Fake Klebestreifen (Tape) oben */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#E5DCC5]/80 backdrop-blur-sm rotate-[3deg] shadow-sm"></div>

                  <img
                      src="/florian.jpg"
                      alt="Florian Maurer - Festwirt"
                      className="w-full h-auto object-cover grayscale-[10%] contrast-110" // Leicht analoger Foto-Look
                  />

                  {/* Handgeschriebener Text auf dem Polaroid */}
                  <div className="absolute bottom-4 left-0 w-full text-center">
                  <span className="font-display font-bold text-2xl text-base-dark/70 opacity-90 rotate-[-2deg] inline-block tracking-wide">
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
              <h3 className="font-sans text-sm md:text-base text-accent-wood font-bold uppercase tracking-widest mb-8">
                {t("subtitle")}
              </h3>

              <div className="space-y-6 font-sans text-lg md:text-xl text-base-dark/80 leading-relaxed">
                <p>
                  {t("p1")}
                </p>
                <p>
                  {t("p2")}
                </p>

                {/* Organisches, wuchtiges Zitat */}
                <div className="relative my-16 py-4">
                  {/* Großes SVG Anführungszeichen im Hintergrund */}
                  <svg className="absolute -top-6 -left-8 w-24 h-24 text-accent-green opacity-10 transform -rotate-6" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                  </svg>

                  <p className="font-display font-black text-3xl md:text-4xl text-base-dark leading-tight relative z-10 pl-4 md:pl-0">
                    {t("quote")}
                  </p>
                </div>

                <p className="text-base text-base-dark/70">
                  {t("p3")}
                </p>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
  );
}