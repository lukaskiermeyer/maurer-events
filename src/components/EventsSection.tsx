"use client";
import type { EventDocument, EventRecord } from '@/types/domain';

import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { reservationBadge, resolveReservationMode } from "@/lib/reservation-mode";
import DocumentViewer from "./DocumentViewer";

const AWNING_CLIP_PATH = (() => {
  const numScallops = 16;
  let path = `M 0,0.25 L 0.5,0 L 1,0.25 L 1,0.5 `;

  for (let i = 0; i < numScallops; i++) {
    const startX = 1 - (0.5 / numScallops) * i;
    const startY = 0.5 - (0.25 / numScallops) * i;
    const endX = 1 - (0.5 / numScallops) * (i + 1);
    const endY = 0.5 - (0.25 / numScallops) * (i + 1);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 + 0.04; // 4% drop for the scallop
    path += `Q ${midX.toFixed(4)},${midY.toFixed(4)} ${endX.toFixed(4)},${endY.toFixed(4)} `;
  }

  for (let i = 0; i < numScallops; i++) {
    const startX = 0.5 - (0.5 / numScallops) * i;
    const startY = 0.25 + (0.25 / numScallops) * i;
    const endX = 0.5 - (0.5 / numScallops) * (i + 1);
    const endY = 0.25 + (0.25 / numScallops) * (i + 1);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 + 0.04;
    path += `Q ${midX.toFixed(4)},${midY.toFixed(4)} ${endX.toFixed(4)},${endY.toFixed(4)} `;
  }

  path += `Z`;
  return path;
})();

// Stoffbahnen wie im echten Festzelt: quer (links→rechts) gespannte Swags,
// die zwischen den Streben tief durchhängen. Reihen zum Fluchtpunkt hin
// schmaler und blasser. Ton im Wechsel grün/beige (Markenfarben).
// Detail: Längsfalten, helle Ober-/dunkle Unterkante, geraffte Pinch-Punkte
// und weicher Schlagschatten lassen die Bahnen wie echten Stoff wirken.
const SWAGS = (() => {
  const vp = { x: 50, y: 250 };
  // Äußere Punkte liegen bewusst außerhalb des Bilds, damit die Bahnen
  // bis über den Bildschirmrand laufen (bleed) statt an der äußersten Strebe zu enden.
  const strutTops = [-35, 5, 20, 35, 50, 65, 80, 95, 135];
  const hw0 = 2.0;
  const sagMul = [1, 0.94, 1.05, 0.96, 1.04, 0.92];
  const foldFr = [-0.55, -0.2, 0.2, 0.55];
  const rows = [
    { y: 24, tone: 'green' },
    { y: 38, tone: 'beige' },
    { y: 52, tone: 'green' },
    { y: 66, tone: 'beige' },
    { y: 80, tone: 'green' },
    { y: 92, tone: 'beige' },
  ];
  return rows.map(({ y, tone }) => {
    const f = (vp.y - y) / vp.y;
    const xs = strutTops.map((xt) => vp.x + (xt - vp.x) * f);
    const hw = hw0 * f;
    const green = tone === 'green';
    const segs = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      segs.push({ x0, x1, midX: (x0 + x1) / 2, sag: 0.9 * (x1 - x0) * sagMul[i % sagMul.length] });
    }
    const edgePath = (off) => {
      let d = `M ${xs[0].toFixed(2)},${(y + off).toFixed(2)}`;
      for (const s of segs) d += ` Q ${s.midX.toFixed(2)},${(y + s.sag + off).toFixed(2)} ${s.x1.toFixed(2)},${(y + off).toFixed(2)}`;
      return d;
    };
    const top = edgePath(-hw);
    const bottom = edgePath(hw);
    let band = `${top} L ${xs[xs.length - 1].toFixed(2)},${(y + hw).toFixed(2)}`;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      band += ` Q ${s.midX.toFixed(2)},${(y + s.sag + hw).toFixed(2)} ${s.x0.toFixed(2)},${(y + hw).toFixed(2)}`;
    }
    band += ' Z';
    const folds = foldFr.map((fr, idx) => ({
      d: edgePath(fr * hw),
      stroke: idx % 2 === 0
        ? (green ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.5)')
        : (green ? 'rgba(0,0,0,0.18)' : 'rgba(194,155,106,0.35)'),
      w: 0.25,
    }));
    let pinch = '';
    for (const x of xs) {
      pinch += `M ${x.toFixed(2)},${(y - hw).toFixed(2)} L ${x.toFixed(2)},${(y + hw).toFixed(2)} `;
      pinch += `M ${(x - 0.5).toFixed(2)},${(y - hw * 0.5).toFixed(2)} L ${(x - 0.3).toFixed(2)},${(y + hw * 0.5).toFixed(2)} `;
      pinch += `M ${(x + 0.5).toFixed(2)},${(y - hw * 0.5).toFixed(2)} L ${(x + 0.3).toFixed(2)},${(y + hw * 0.5).toFixed(2)} `;
    }
    return {
      shadow: band,
      band,
      top,
      bottom,
      folds,
      pinch,
      tone,
      edge: green ? 'none' : '#C29B6A',
      topStroke: green ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)',
      bottomStroke: green ? 'rgba(0,0,0,0.25)' : 'rgba(194,155,106,0.4)',
      pinchStroke: green ? 'rgba(0,0,0,0.3)' : 'rgba(194,155,106,0.45)',
    };
  });
})();

export default function EventsSection({ initialEvents, documentsByEvent = {} }: { initialEvents: EventRecord[]; documentsByEvent?: Record<string, EventDocument[]> }) {
  const t = useTranslations("Events");
  const locale = useLocale();
  const [documentView, setDocumentView] = useState<{ documents: EventDocument[]; title: string } | null>(null);

  return (
      <section id="events" className="relative w-full bg-base-light py-24 md:py-32 overflow-hidden -mt-[2px] z-10">

        {/* 3D Tent Background Elements */}
        {/* SVG ClipPath Definition for Scallops */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <clipPath id="scalloped-awning" clipPathUnits="objectBoundingBox">
              <path d={AWNING_CLIP_PATH} />
            </clipPath>
          </defs>
        </svg>

        {/* Fluchtpunkt-Streben (Perspective Beams) */}
        <div className="absolute top-0 left-0 w-full h-[400px] md:h-[600px] z-0 pointer-events-none overflow-hidden">
          {/* White canvas ceiling background */}
          <div className="absolute inset-0 bg-[#F9F7F3] opacity-30"></div>

          <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" className="opacity-90">
            <defs>
              <radialGradient id="beam-fade" cx="50" cy="100" r="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#C29B6A" stopOpacity="0" />
                <stop offset="30%" stopColor="#C29B6A" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#C29B6A" stopOpacity="0.9" />
              </radialGradient>
              <linearGradient id="swag-green" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#20603C" stopOpacity="0.85" />
                <stop offset="55%" stopColor="#20603C" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#20603C" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="swag-beige" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F4F0E8" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#F4F0E8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F4F0E8" stopOpacity="0" />
              </linearGradient>
              <filter id="swag-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.7" />
              </filter>
            </defs>
            <g stroke="url(#beam-fade)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Center Beam (Ridge) - slightly offset to prevent zero-width bbox bug in SVG */}
              <line x1="49.9" y1="250" x2="50.1" y2="0" strokeWidth="3" />

              {/* Left Beams (3 per side) - strictly inside visible bounds */}
              <line x1="50" y1="250" x2="35" y2="0" />
              <line x1="50" y1="250" x2="20" y2="0" />
              <line x1="50" y1="250" x2="5" y2="0" />

              {/* Right Beams (3 per side) - strictly inside visible bounds */}
              <line x1="50" y1="250" x2="65" y2="0" />
              <line x1="50" y1="250" x2="80" y2="0" />
              <line x1="50" y1="250" x2="95" y2="0" />

            </g>

            {/* Stoffbahnen: quer gespannte Swags mit Falten, Kanten & Schatten */}
            <g>
              {SWAGS.map((s, i) => (
                <g key={i} className={i % 2 === 1 ? 'max-md:hidden' : undefined}>
                  <path d={s.shadow} fill="#000" opacity="0.07" filter="url(#swag-blur)" transform="translate(0 1.2)" />
                  <path d={s.band} fill={s.tone === 'green' ? 'url(#swag-green)' : 'url(#swag-beige)'} stroke={s.edge} strokeWidth="0.3" strokeOpacity="0.35" />
                  {s.folds.map((fd, j) => (
                    <path key={j} d={fd.d} fill="none" stroke={fd.stroke} strokeWidth={fd.w} />
                  ))}
                  <path d={s.top} fill="none" stroke={s.topStroke} strokeWidth="0.3" />
                  <path d={s.bottom} fill="none" stroke={s.bottomStroke} strokeWidth="0.35" />
                  <path d={s.pinch} fill="none" stroke={s.pinchStroke} strokeWidth="0.25" opacity="0.6" />
                </g>
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-base-light/60 to-base-light"></div>
        </div>

        {/* Dach-Struktur (Giebel & Markise) */}
        <div className="absolute top-0 left-0 w-full h-[150px] md:h-[250px] z-20 pointer-events-none drop-shadow-2xl">
          {/* Konstantes grünes Dach (Giebel oben, füllt die oberen Ecken aus) */}
          <div
              className="absolute inset-0 bg-accent-green"
              style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 25%, 0% 50%)' }}
          ></div>

          {/* Einfarbige beige Markise mit Rüschen (Scalloped Edge) */}
          <div
              className="absolute inset-0"
              style={{
                background: 'var(--color-canvas-light)',
                clipPath: 'url(#scalloped-awning)'
              }}
          ></div>

          {/* Dünner schwarzer Strich als obere Umrandung */}
          <svg
              className="absolute inset-0 w-full h-full z-30 pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
          >
            <polyline
                points="0,25 50,0 100,25"
                fill="none"
                stroke="#171717"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 mt-[40px] md:mt-[60px] lg:mt-[100px] relative z-30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-20 gap-6">
            <div>
              <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
                  className="font-display font-bold text-5xl md:text-7xl mb-4 text-base-dark"
              >
                {t("title_1_alt") || "Unsere"} <span className="text-accent-green italic">{t("title_2_alt") || "Volksfeste"}</span>
              </motion.h2>
              <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
                  className="font-sans text-lg text-base-dark/60 font-medium"
              >
                {t("subtitle")}
              </motion.p>
            </div>
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.65 }}
            >
              <Link href="/termine" className="text-base-dark bg-border-light px-6 py-3 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide flex items-center gap-3 transition-colors text-sm shadow-sm">
                {t("view_all")}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </motion.div>
          </div>

          <div className="space-y-4">
            {initialEvents.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-accent-green/20 rounded-3xl p-12 md:p-24 text-center flex flex-col items-center justify-center"
                >
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 text-accent-green shadow-sm">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-subhead text-3xl md:text-5xl text-base-dark mb-4">{t("empty_title_1")} <span className="text-accent-green">{t("empty_title_2")}</span></h3>
                  <p className="font-sans text-base-dark/70 max-w-lg mx-auto text-lg leading-relaxed">
                    {t("empty_text")}
                  </p>
                </motion.div>
            ) : (
                initialEvents.map((event, index: number) => {
                  const dateObj = new Date(event.date);
                  const day = dateObj.getDate().toString().padStart(2, '0');
                  const monthNamesDe = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
                  const monthNamesEn = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                  const month = locale === 'en' ? monthNamesEn[dateObj.getMonth()] : monthNamesDe[dateObj.getMonth()];
                  const year = dateObj.getFullYear();

                  const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
                  const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
                  const location = locale === "en" && event.locationEn ? event.locationEn : event.location;
                  const badge = reservationBadge(resolveReservationMode(event), locale);
                  const docs = (documentsByEvent[event.id] || []).filter(document => document.isPublic);
                  const menus = docs.filter(document => document.kind === "menu");
                  const programs = docs.filter(document => document.kind === "program");

                  return (
                      <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: index * 0.1 }}
                      >
                        <div className="group relative bg-white border border-border-light rounded-2xl hover:border-accent-green hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                        <Link href={`/termine/${event.id}`} className="absolute inset-0 z-0" aria-label={title} />
                        <div className="relative z-10 pointer-events-none flex flex-col md:flex-row">
                          
                          {/* Black Date Stripe */}
                          <div className="w-full md:w-24 bg-base-dark text-white flex md:flex-col items-center justify-center gap-2 md:gap-1 px-4 py-3 md:py-6 shrink-0 border-t-4 border-accent-green md:border-t-0 md:border-l-4">
                            <span className="font-display font-black text-3xl md:text-4xl leading-none text-accent-green">{day}.</span>
                            <span className="font-display font-bold text-xs md:text-sm uppercase tracking-widest text-white">{month}</span>
                            <span className="font-display text-xs md:text-sm text-white/60">{year}</span>
                          </div>

                          {/* Poster Area */}
                          {event.imageUrl && (
                            <div className="shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={event.imageUrl} alt={title} className="h-auto w-auto max-h-[480px] max-w-full object-contain group-hover:scale-105 transition-transform duration-700" />
                            </div>
                          )}

                          {/* Content Area */}
                          <div className="w-full md:flex-1 p-5 md:p-8 flex flex-col justify-between">
                            <div>
                              <h3 className="font-subhead text-2xl md:text-4xl mb-3 text-base-dark group-hover:text-accent-green transition-colors leading-tight">{title}</h3>
                              {badge && (
                                  <span className="inline-block bg-base-dark text-white font-bold text-xs uppercase tracking-widest px-3 py-1 mb-3 shadow-md rounded">
                                    {badge}
                                  </span>
                              )}
                              <p className="font-sans text-sm md:text-base text-base-dark/70 mb-5 line-clamp-3 leading-relaxed whitespace-pre-line">{(description || '').replace(/[#*_`~\[\]()]/g, '').replace(/\s+/g, ' ').trim()}</p>
                              <div className="flex items-center gap-2 text-sm md:text-base font-bold text-accent-green">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {location}{event.zip ? ` · ${event.zip}` : ""}
                               </div>
                               <a
                                 href={event.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location, event.zip].filter(Boolean).join(" "))}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="relative z-20 pointer-events-auto inline-flex items-center gap-1.5 text-xs font-bold text-accent-green hover:underline mt-1"
                               >
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                 </svg>
                                 Karte öffnen
                               </a>
                            </div>

                            <div className="mt-auto pt-5 border-t border-border-light/60 flex flex-wrap items-center justify-between gap-3">
                              {docs.length > 0 ? (
                                <div className="relative z-20 pointer-events-auto flex flex-wrap gap-2">
                                  {menus.length > 0 && (
                                    <button type="button" onClick={() => setDocumentView({ documents: menus, title })} className="inline-flex items-center gap-2 bg-canvas-light border border-border-light text-base-dark px-3 py-2 rounded-full font-bold text-xs uppercase tracking-wider hover:border-accent-green transition-colors">
                                      {locale === "en" ? "Menu" : "Speisekarte"}
                                    </button>
                                  )}
                                  {programs.length > 0 && (
                                    <button type="button" onClick={() => setDocumentView({ documents: programs, title })} className="inline-flex items-center gap-2 bg-canvas-light border border-border-light text-base-dark px-3 py-2 rounded-full font-bold text-xs uppercase tracking-wider hover:border-accent-green transition-colors">
                                      {locale === "en" ? "Program" : "Programm"}
                                    </button>
                                  )}
                                </div>
                              ) : <span />}
                              <span className="inline-flex items-center gap-2 bg-accent-green text-white px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest group-hover:bg-accent-green/80 transition-colors shadow-sm">
                                {t("details_btn")}
                                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                              </span>
                            </div>
                          </div>
                        </div>
                        </div>
                      </motion.div>
                  );
                }))}
          </div>
        </div>
        <DocumentViewer
          key={documentView?.documents.map(document => document.id).join(",") || "closed"}
          open={!!documentView}
          onClose={() => setDocumentView(null)}
          documents={documentView?.documents || []}
          title={documentView?.title || ""}
          locale={locale}
        />
      </section>
  );
}
