"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";

export type PartnerLogo = { name: string; src: string };

// Platzhalter, solange keine Logos in public/partners/ liegen.
const PLACEHOLDER_COUNT = 6;

function PartnerCircle({ logo, placeholderLabel }: { logo?: PartnerLogo; placeholderLabel: string }) {
  return (
    <div className="shrink-0 w-28 h-28 md:w-36 md:h-36 rounded-full bg-white border border-border-light shadow-sm flex items-center justify-center overflow-hidden">
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.name}
          width={160}
          height={160}
          sizes="(max-width: 768px) 112px, 144px"
          className="w-[70%] h-[70%] object-contain"
        />
      ) : (
        <div className="w-full h-full rounded-full border border-border-light flex flex-col items-center justify-center gap-2 text-base-dark/40 px-3 text-center">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.75l7.75 7.75-7.75 7.75L4.25 12.5z" />
          </svg>
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-tight">{placeholderLabel}</span>
        </div>
      )}
    </div>
  );
}

export default function PartnersSection({ logos }: { logos: PartnerLogo[] }) {
  const t = useTranslations("Partners");
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // Sanfte Gegenbewegung beider Reihen beim Scrollen.
  const xLeft = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);
  const xRight = useTransform(scrollYProgress, [0, 1], ["4%", "-4%"]);

  const items = logos.length > 0
    ? logos
    : Array.from({ length: PLACEHOLDER_COUNT }, () => undefined);
  const rowA = items.filter((_, index) => index % 2 === 0);
  const rowB = items.filter((_, index) => index % 2 === 1);

  return (
    <section id="partners" ref={ref} className="py-16 md:py-24 bg-canvas-light relative overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 text-center">
        <h2 className="font-display font-bold text-4xl md:text-6xl mb-3 text-base-dark">
          {t("title_1")} <span className="text-accent-green italic">{t("title_2")}</span>
        </h2>
        <p className="font-sans text-base md:text-lg text-base-dark/60 font-medium max-w-xl mx-auto mb-10 md:mb-14">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-6 md:space-y-8" aria-label={t("title_2")}>
        <motion.div style={{ x: xLeft }} className="flex justify-center gap-6 md:gap-10 px-6">
          {rowA.map((logo, index) => (
            <PartnerCircle key={logo?.src ?? `a-${index}`} logo={logo} placeholderLabel={t("placeholder")} />
          ))}
        </motion.div>
        <motion.div style={{ x: xRight }} className="flex justify-center gap-6 md:gap-10 px-6">
          {rowB.map((logo, index) => (
            <PartnerCircle key={logo?.src ?? `b-${index}`} logo={logo} placeholderLabel={t("placeholder")} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
