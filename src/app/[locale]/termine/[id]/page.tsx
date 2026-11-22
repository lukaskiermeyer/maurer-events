import React from "react";
import { getEvents, getEventById } from "@/app/actions/events";
import { getEventGalleryImages, getAlbumsForEvent } from "@/app/actions/gallery";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import dynamicComponent from "next/dynamic";

import { getTranslations } from "next-intl/server";
import EmailReservationCard from "@/components/EmailReservationCard";
import EventDocuments from "@/components/EventDocuments";
import EventMapEmbed from "@/components/EventMapEmbed";
import EventDetailStage from "@/components/event-detail/EventDetailStage";
import DescriptionRenderer from "@/components/DescriptionRenderer";
import GalleryGrid from "@/components/GalleryGrid";
import { getPublicEventDocuments } from "@/app/actions/eventDocuments";
import { resolveReservationMode } from "@/lib/reservation-mode";
import { localized, DATE_TAG } from "@/lib/localize";

export const revalidate = 60;

const ReservationSection = dynamicComponent(() => import("@/components/ReservationSection"), {
  loading: () => <div className="animate-pulse h-96 bg-white/5 rounded-3xl mt-32"></div>
});

const GALLERY_TEASER_COUNT = 8;

function formatDateRange(start: Date, end: Date | null, locale: string): string {
  const tag = DATE_TAG[locale] ?? "de-DE";
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

/**
 * Kurze Google-Maps-Links (maps.app.goo.gl, goo.gl, g.co) werden serverseitig
 * aufgelöst, damit die eingebettete Karte die echten Koordinaten/Adressen
 * anzeigen kann (clientseitig blockiert CORS die Auflösung).
 */
async function resolveShortMapsUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const shortHosts = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
    if (!shortHosts.has(host)) return url;
    let current = url;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, { redirect: "manual" });
      const loc = res.headers.get("location");
      if (!loc) return current;
      current = new URL(loc, current).toString();
      if (!shortHosts.has(new URL(current).hostname)) return current;
    }
    return current;
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event nicht gefunden" };

  const title = localized(event, "title", locale);
  const description = localized(event, "description", locale);

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

  const [event, galleryImages, eventAlbums, upcomingEvents, documents, t] = await Promise.all([
    getEventById(id),
    getEventGalleryImages(id),
    getAlbumsForEvent(id),
    getEvents(),
    getPublicEventDocuments(id),
    getTranslations({ locale, namespace: "EventDetail" })
  ]);

  if (!event) {
    notFound();
  }

  // Foto-Sektion verlinkt auf das Album dieses Festes (falls vorhanden).
  const galleryAlbumHref = eventAlbums.length > 0 ? `/galerie/${eventAlbums[0].id}` : "/galerie";

  const resolvedMapUrl = await resolveShortMapsUrl(event.mapUrl);

  const title = localized(event, "title", locale);
  const description = localized(event, "description", locale);
  const location = localized(event, "location", locale);
  const reservationMode = resolveReservationMode(event);
  const dateLabel = formatDateRange(new Date(event.date), event.endDate ? new Date(event.endDate) : null, locale);
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
        ...(event.zip ? { "postalCode": event.zip } : {}),
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

      <EventDetailStage event={event} dateLabel={dateLabel} resolvedMapUrl={resolvedMapUrl} />

      {/* Event Details Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-12 md:mt-16">
        <div className="max-w-3xl">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-6 text-base-dark">
            {t("about_1")} <span className="text-accent-green">{t("about_2")}</span>
          </h2>
          <DescriptionRenderer content={description} />
          {location && (
            <div className="mt-10 lg:hidden">
              <EventMapEmbed
                mapUrl={event.mapUrl}
                embedMapUrl={resolvedMapUrl}
                location={location}
                zip={event.zip}
                title={title}
                locale={locale}
              />
            </div>
          )}
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
              href={galleryAlbumHref}
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
