"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { EventRecord } from "@/types/domain";
import { reservationBadge, reservationStatusLabel, resolveReservationMode } from "@/lib/reservation-mode";
import FestzeltCeiling from "@/components/FestzeltCeiling";
import EventMapEmbed from "@/components/EventMapEmbed";
import { localized } from "@/lib/localize";

export default function EventDetailStage({ event, dateLabel, resolvedMapUrl }: { event: EventRecord; dateLabel: string; resolvedMapUrl?: string | null }) {
  const t = useTranslations("EventDetail");
  const locale = useLocale();

  const title = localized(event, "title", locale);
  const location = localized(event, "location", locale);
  const mode = resolveReservationMode(event);
  const badge = reservationBadge(mode, locale);
  const statusLabel = reservationStatusLabel(mode, locale);
  const reservationCta = mode === "online" ? t("reserve_cta") : mode === "email" ? t("email_cta") : null;

  return (
    <section className="relative w-full bg-base-light overflow-hidden">
      <FestzeltCeiling compact />

      {/* Inhalt beginnt unterhalb der Banner-Spitzen (compact: ~317/379/421px) inkl. Pendel-Ausschlag */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 pt-[345px] md:pt-[405px] lg:pt-[445px] pb-10 md:pb-12 relative z-30">
        <div
          className={`grid grid-cols-1 gap-10 lg:gap-14 xl:gap-16 ${
            event.imageUrl ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-stretch" : ""
          }`}
        >
          <div className="max-w-2xl flex flex-col justify-between gap-6">
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Link
                  href="/termine"
                  className="inline-flex items-center gap-2 bg-border-light text-base-dark px-4 py-2 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide text-xs transition-colors shadow-sm mb-4"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  {t("back")}
                </Link>
              </motion.div>

              {badge && (
                <motion.span
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                  className="inline-block bg-accent-green-deep text-white font-bold text-xs uppercase tracking-widest px-3 py-1 mb-4 shadow-md rounded"
                >
                  {badge}
                </motion.span>
              )}

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                className="font-display font-black text-2xl md:text-4xl xl:text-5xl text-base-dark leading-[1.05] tracking-headline"
              >
                {title}
              </motion.h1>

            </div>

            {location && (
              <div className="hidden lg:block max-w-md">
                <EventMapEmbed
                  mapUrl={event.mapUrl}
                  embedMapUrl={resolvedMapUrl}
                  location={location}
                  zip={event.zip}
                  title={title}
                  locale={locale}
                  height={160}
                />
              </div>
            )}

            <div className="border-t border-border-light pt-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
                className="flex flex-wrap items-end gap-x-8 gap-y-4"
              >
                <div>
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("date")}</span>
                  <span className="font-sans font-bold text-base-dark">{dateLabel}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("location")}</span>
                  <span className="font-sans font-bold text-base-dark">{location}{event.zip ? ` · ${event.zip}` : ""}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("status")}</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent-green/10 text-accent-green font-bold text-sm">
                    {statusLabel}
                  </span>
                </div>
              </motion.div>

              {reservationCta && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.45 }}
                >
                  <a
                    href="#reservierung"
                    className="mt-6 inline-flex items-center justify-center gap-2 bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-accent-green/80 transition-colors shadow-sm"
                  >
                    {reservationCta}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </motion.div>
              )}
            </div>
          </div>

          {event.imageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
              className="w-full max-w-[260px] mx-auto lg:max-w-none lg:mx-0 [perspective:1200px]"
            >
              {/* Papierkanten: gestapelte translateZ-Ebenen in preserve-3d erzeugen die Druckstärke */}
              <div className="relative [transform-style:preserve-3d] [transform:rotateY(-9deg)_rotateX(3deg)_rotateZ(-0.5deg)] hover:[transform:rotateY(-3deg)_rotateX(1deg)] transition-transform duration-500">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[4px] bg-[#c9c2b4] [transform:translateZ(-6px)_translateX(4px)_translateY(4px)] shadow-[24px_32px_56px_-24px_rgba(10,10,10,0.45),0_2px_6px_rgba(10,10,10,0.15)]"
                />
                <div aria-hidden className="absolute inset-0 rounded-[4px] bg-white [transform:translateZ(-3px)_translateX(2px)_translateY(2px)]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.imageUrl}
                  alt={title}
                  className="relative w-full h-auto rounded-[4px]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[4px] bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none [transform:translateZ(1px)]"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}