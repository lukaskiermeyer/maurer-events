import React from "react";
import { getEvents, getEventById } from "@/app/actions/events";
import { getGalleryImages } from "@/app/actions/gallery";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import dynamicComponent from "next/dynamic";
import parse from 'html-react-parser';
import sanitizeHtml from 'sanitize-html';
import { getTranslations } from "next-intl/server";
import EmailReservationCard from "@/components/EmailReservationCard";
import EventDocuments from "@/components/EventDocuments";
import EventDetailStage from "@/components/event-detail/EventDetailStage";
import GalleryGrid from "@/components/GalleryGrid";
import { getPublicEventDocuments } from "@/app/actions/eventDocuments";
import { reservationStatusLabel, resolveReservationMode } from "@/lib/reservation-mode";

export const revalidate = 60;

const ReservationSection = dynamicComponent(() => import("@/components/ReservationSection"), {
  loading: () => <div className="animate-pulse h-96 bg-white/5 rounded-3xl mt-32"></div>
});

const GALLERY_TEASER_COUNT = 8;

function formatDateRange(start: Date, end: Date | null, locale: string): string {
  const tag = locale === "en" ? "en-US" : "de-DE";
  const full = (date: Date) => date.toLocaleDateString(tag, { day: "2-digit", month: "long", year: "numeric" });
  if (!end || end.getTime() === start.getTime()) return full(start);
  if (end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth()) {
    return locale === "en"
      ? `${start.toLocaleDateString(tag, { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
      : `${start.getDate()}.–${full(end)}`;
  }
  if (end.getFullYear() === start.getFullYear()) {
    return locale === "en"
      ? `${start.toLocaleDateString(tag, { month: "long", day: "numeric" })} – ${full(end)}`
      : `${start.toLocaleDateString(tag, { day: "2-digit", month: "long" })} – ${full(end)}`;
  }
  return `${full(start)} – ${full(end)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event nicht gefunden" };

  const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
  const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;

  return {
    title: `${title} | MAURER EVENTS`,
    description: description,
    openGraph: {
      title: `${title} | MAURER EVENTS`,
      description: description,
      images: event.imageUrl ? [{ url: event.imageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | MAURER EVENTS`,
      description: description,
      images: event.imageUrl ? [event.imageUrl] : [],
    }
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await params;

  const [event, galleryImages, upcomingEvents, documents, t] = await Promise.all([
    getEventById(id),
    getGalleryImages(id),
    getEvents(),
    getPublicEventDocuments(id),
    getTranslations({ locale, namespace: "EventDetail" })
  ]);

  if (!event) {
    notFound();
  }

  const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
  const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
  const location = locale === "en" && event.locationEn ? event.locationEn : event.location;
  const reservationMode = resolveReservationMode(event);
  const statusLabel = reservationStatusLabel(reservationMode, locale);
  const dateLabel = formatDateRange(new Date(event.date), event.endDate ? new Date(event.endDate) : null, locale);
  const reservationCta = reservationMode === "online" ? t("reserve_cta") : reservationMode === "email" ? t("email_cta") : null;
  const galleryTeaser = galleryImages.slice(0, GALLERY_TEASER_COUNT);

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": title,
    "description": description,
    "startDate": new Date(event.date).toISOString(),
    "endDate": event.endDate ? new Date(event.endDate).toISOString() : new Date(event.date).toISOString(),
    "image": event.imageUrl ? [event.imageUrl] : [],
    "location": {
      "@type": "Place",
      "name": location,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": location,
      }
    },
    "organizer": {
      "@type": "Organization",
      "name": "Maurer Events",
      "url": "https://maurer-events.com"
    }
  };

  return (
    <div className="min-h-screen bg-base-light">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema).replace(/</g, '\\u003c') }}
      />

      <EventDetailStage event={event} dateLabel={dateLabel} />

      {/* Event Details Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-16 md:mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          <div className="lg:col-span-2">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-6 text-base-dark">
              {t("about_1")} <span className="text-accent-green">{t("about_2")}</span>
            </h2>
            <div className="event-prose font-sans text-base-dark/80 max-w-none">
              {/* Parse the HTML output from the rich text editor safely */}
              {parse(sanitizeHtml((description || '').replace(/\r\n|\r|\n/g, '<br>'), {
                allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
                allowedAttributes: {
                  'a': ['href', 'target', 'rel']
                }
              }))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-canvas-light p-8 rounded-3xl border border-border-light border-t-4 border-t-accent-green sticky top-32 shadow-sm">
              <h3 className="font-display font-bold text-xl mb-6 text-base-dark">{t("overview")}</h3>
              <ul className="space-y-6">
                <li>
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("date")}</span>
                  <span className="font-sans font-bold text-base-dark">{dateLabel}</span>
                </li>
                <li className="pt-6 border-t border-border-light">
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("location")}</span>
                  <span className="font-sans font-bold text-base-dark">{location}</span>
                </li>
                <li className="pt-6 border-t border-border-light">
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">{t("status")}</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent-green/10 text-accent-green font-bold text-sm">
                    {statusLabel}
                  </span>
                </li>
              </ul>
              {location && (
                 <div className="mt-6 pt-6 border-t border-border-light">
                   <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-2">Karte</span>
                   <div className="rounded-2xl overflow-hidden border border-border-light">
                     <iframe
                       src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
                       width="100%"
                       height="200"
                       style={{ border: 0 }}
                       loading="lazy"
                       referrerPolicy="no-referrer-when-downgrade"
                       title={`Karte: ${location}`}
                     />
                   </div>
                   <a
                     href={event.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-accent-green hover:underline"
                   >
                     In Google Maps öffnen
                   </a>
                 </div>
               )}
               {reservationCta && (
                <a
                  href="#reservierung"
                  className="mt-8 flex items-center justify-center gap-2 bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-base-dark transition-colors shadow-sm"
                >
                  {reservationCta}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Section */}
      <EventDocuments documents={documents} title={title} locale={locale} />
      {reservationMode === "online" && (
        <div id="reservierung" className="mt-24 md:mt-32 scroll-mt-32">
          {/* ReservationSection loaded dynamically */}
          <ReservationSection
            initialEvents={[event, ...upcomingEvents.filter(upcoming => upcoming.id !== event.id)]}
            initialSelectedEvent={event.id}
          />
        </div>
      )}
      {reservationMode === "email" && (
        <div id="reservierung" className="scroll-mt-32">
          <EmailReservationCard event={event} locale={locale} />
        </div>
      )}

      {/* Gallery Section */}
      {galleryImages.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 mt-24 md:mt-32 mb-20">
          <h2 className="font-display font-black text-4xl md:text-5xl mb-10 text-center text-base-dark">
            {t("gallery_1")} <span className="text-accent-green">{t("gallery_2")}</span>
          </h2>
          <GalleryGrid images={galleryTeaser} />
          <div className="mt-10 text-center">
            <Link
              href={`/galerie/${event.id}`}
              className="inline-flex items-center gap-3 bg-border-light text-base-dark px-6 py-3 rounded-full hover:bg-accent-green hover:text-white font-display font-bold uppercase tracking-wide text-sm transition-colors shadow-sm"
            >
              {t("gallery_all")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
