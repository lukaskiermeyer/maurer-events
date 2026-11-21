"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { EventRecord } from "@/types/domain";
import { reservationBadge, resolveReservationMode } from "@/lib/reservation-mode";
import FestzeltCeiling from "@/components/FestzeltCeiling";
import { localized, MONTHS } from "@/lib/localize";


export default function EventDetailStage({ event, dateLabel }: { event: EventRecord; dateLabel: string }) {
  const t = useTranslations("EventDetail");
  const locale = useLocale();

  const title = localized(event, "title", locale);
  const location = localized(event, "location", locale);
  const zip = event.zip;
  const badge = reservationBadge(resolveReservationMode(event), locale);

  const dateObj = new Date(event.date);
  const day = dateObj.getDate().toString().padStart(2, "0");
  const month = (MONTHS[locale] ?? MONTHS.de)[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return (
    <section className="relative w-full bg-base-light overflow-hidden">
      <FestzeltCeiling />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 pt-[280px] md:pt-[400px] lg:pt-[480px] pb-16 md:pb-24 relative z-30">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Link
            href="/termine"
            className="inline-flex items-center gap-2 bg-border-light text-base-dark px-5 py-2.5 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide text-sm transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t("back")}
          </Link>
        </motion.div>

        <div className="mt-10 md:mt-12 flex flex-col lg:flex-row gap-12 lg:gap-20 items-center lg:items-start">
          <div className="flex-1 w-full text-center lg:text-left">
            {badge && (
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                className="inline-block bg-base-dark text-white font-bold text-xs uppercase tracking-widest px-3 py-1 mb-6 shadow-md rounded"
              >
                {badge}
              </motion.span>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="font-display font-black text-5xl md:text-7xl xl:text-8xl text-base-dark leading-[0.95] tracking-headline mb-10"
            >
              {title}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm border border-border-light rounded-2xl px-5 py-4 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-widest text-accent-wood mb-0.5">{t("date")}</span>
                  <span className="font-bold text-base-dark leading-tight block">{dateLabel}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm border border-border-light rounded-2xl px-5 py-4 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-widest text-accent-wood mb-0.5">{t("location")}</span>
                  <span className="font-bold text-base-dark leading-tight block">{location}{zip ? ` · ${zip}` : ""}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {event.imageUrl && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
              className="w-full sm:w-auto lg:flex-shrink-0 flex justify-center lg:justify-end"
            >
              {/* Plakat mit Datums-Streifen wie in den Event-Karten der Landingpage */}
              <div className="inline-flex flex-col md:flex-row items-stretch bg-white border border-border-light rounded-2xl overflow-hidden shadow-2xl transform md:rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="bg-base-dark text-white flex md:flex-col items-center justify-center gap-2 md:gap-1 px-4 py-3 md:py-6 md:w-24 shrink-0 border-t-4 border-accent-green md:border-t-0 md:border-l-4">
                  <span className="font-display font-black text-3xl md:text-4xl leading-none text-accent-green">{day}.</span>
                  <span className="font-display font-bold text-xs md:text-sm uppercase tracking-widest text-white">{month}</span>
                  <span className="font-display text-xs md:text-sm text-white/60">{year}</span>
                </div>
                <div className="p-3 md:p-4 bg-white flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.imageUrl}
                    alt={title}
                    className="h-auto w-auto max-h-[420px] md:max-h-[560px] max-w-full object-contain"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
