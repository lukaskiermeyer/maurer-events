import React from "react";
import { getEvents } from "@/app/actions/events";
import { getGalleryImages } from "@/app/actions/gallery";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { notFound } from "next/navigation";
import dynamicComponent from "next/dynamic";
import parse from 'html-react-parser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ReservationSection = dynamicComponent(() => import("@/components/ReservationSection"), {
  loading: () => <div className="animate-pulse h-96 bg-white/5 rounded-3xl mt-32"></div>
});



export async function generateMetadata({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await params;
  const upcomingEvents = await getEvents();
  const event = upcomingEvents.find(e => e.id === id);
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
  const upcomingEvents = await getEvents();
  const event = upcomingEvents.find(e => e.id === id);

  if (!event) {
    notFound();
  }

  const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
  const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
  const location = locale === "en" && event.locationEn ? event.locationEn : event.location;

  const galleryImages = await getGalleryImages(event.id);

  const dateObj = new Date(event.date);
  const dateStr = dateObj.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      {/* Event Header Banner */}
      <div className="bg-canvas-light border-b border-border-light pt-32 pb-20 relative overflow-hidden">
        {event.imageUrl && (
           <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110" style={{ backgroundImage: `url(${event.imageUrl})` }}></div>
        )}
        <div className="absolute inset-0 opacity-20 bg-accent-green mix-blend-overlay"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-accent-green/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10 flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          
          <div className="flex-1 w-full text-center lg:text-left">
            <Link href="/termine" className="inline-flex items-center text-sm font-bold uppercase tracking-widest text-accent-green hover:text-base-dark transition-colors mb-8 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/50">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {locale === "en" ? "Back to Overview" : "Zurück zur Übersicht"}
            </Link>
            
            <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl text-base-dark leading-[0.9] mb-10 drop-shadow-sm">
              {title}
            </h1>
            
            <div className="flex flex-wrap gap-6 text-base-dark/80 font-sans text-lg justify-center lg:justify-start">
              <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-white/50">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent-green shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-widest text-base-dark/50 mb-0.5">{locale === "en" ? "Date" : "Datum"}</span>
                  <span className="font-bold text-base-dark leading-tight block">{dateStr}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-white/50">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent-green shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-widest text-base-dark/50 mb-0.5">{locale === "en" ? "Location" : "Location"}</span>
                  <span className="font-bold text-base-dark leading-tight block">{location}</span>
                </div>
              </div>
            </div>
          </div>

          {event.imageUrl && (
            <div className="w-full sm:w-[500px] lg:w-[600px] flex-shrink-0 mt-8 lg:mt-0 perspective-1000">
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border-8 border-white/90 bg-white transform md:rotate-2 hover:rotate-0 hover:scale-[1.02] transition-all duration-500">
                <Image 
                  src={event.imageUrl} 
                  alt={title} 
                  fill
                  className="object-cover" 
                />
              </div>
            </div>
          )}
          
        </div>
      </div>

      {/* Event Details Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <h2 className="font-display font-bold text-3xl mb-6 text-base-dark">
              {locale === "en" ? "About this Event" : "Über dieses Event"}
            </h2>
            <div className="prose prose-lg font-sans text-base-dark/80 max-w-none">
              {/* Parse the HTML output from the rich text editor safely */}
              {parse(description)}
              
              {!description.includes("<") && ( // Fallback if description is just plain text from old DB entries
                <p className="mt-4">
                  {locale === "en" 
                    ? "(This is a placeholder for more detailed descriptions, line-ups, menus, or special features of this exact event.)"
                    : "(Hier ist Platz für ausführlichere Beschreibungen, Line-ups, Menükarten oder Besonderheiten zu genau dieser Veranstaltung. Da die Texte dynamisch über das CMS oder die Datenstruktur geladen werden können, bietet dieses Layout die perfekte Bühne für alle wichtigen Details.)"}
                </p>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-canvas-light p-8 rounded-3xl border border-border-light sticky top-32">
              <h3 className="font-display font-bold text-xl mb-6 text-base-dark">Event-Übersicht</h3>
              <ul className="space-y-6">
                <li>
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">Datum</span>
                  <span className="font-sans font-bold text-base-dark">{dateStr}</span>
                </li>
                <li className="pt-6 border-t border-border-light">
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">Ort</span>
                  <span className="font-sans font-bold text-base-dark">{event.location}</span>
                </li>
                <li className="pt-6 border-t border-border-light">
                  <span className="block text-xs uppercase tracking-widest text-accent-wood font-bold mb-1">Status</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent-green/10 text-accent-green font-bold text-sm">
                    Plätze verfügbar
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Section */}
      {event.reservable && (
        <div className="mt-32">
          <ReservationSection initialEvents={upcomingEvents} initialSelectedEvent={event.id} />
        </div>
      )}

      {/* Gallery Section */}
      {galleryImages.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-32 mb-20">
          <h2 className="font-display font-black text-4xl mb-8 text-center text-base-dark">Rückblick: <span className="text-accent-green">Galerie</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map(img => (
              <div key={img.id} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
                <Image src={img.imageUrl} alt="Event Foto" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
