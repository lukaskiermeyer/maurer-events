import React from "react";
import { getEvents } from "@/app/actions/events";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReservationSection from "@/components/ReservationSection";

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upcomingEvents = await getEvents();
  const event = upcomingEvents.find(e => e.id === id);
  if (!event) return { title: "Event nicht gefunden" };
  return { title: `${event.title} | MAURER EVENTS` };
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

  const dateObj = new Date(event.date);
  const dateStr = dateObj.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-base-light">
      {/* Event Header Banner */}
      <div className="bg-canvas-light border-b border-border-light pt-32 pb-20 relative overflow-hidden">
        {event.imageUrl && (
           <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${event.imageUrl})` }}></div>
        )}
        <div className="absolute inset-0 opacity-10 bg-accent-wood"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-accent-wood/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
          <Link href="/termine" className="inline-flex items-center text-sm font-bold uppercase tracking-widest text-accent-wood hover:text-base-dark transition-colors mb-8">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {locale === "en" ? "Back to Overview" : "Zurück zur Übersicht"}
          </Link>
          
          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl text-base-dark leading-[0.9] mb-8">
            {title}
          </h1>
          
          <div className="flex flex-wrap gap-8 text-base-dark/80 font-sans text-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent-wood shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-bold">{dateStr}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent-wood shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="font-bold">{location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event Details Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <h2 className="font-display font-bold text-3xl mb-6 text-base-dark">
              {locale === "en" ? "About this Event" : "Über dieses Event"}
            </h2>
            <div className="prose prose-lg font-sans text-base-dark/80">
              <p className="text-xl leading-relaxed mb-6">
                {description}
              </p>
              <p>
                {locale === "en" 
                  ? "(This is a placeholder for more detailed descriptions, line-ups, menus, or special features of this exact event.)"
                  : "(Hier ist Platz für ausführlichere Beschreibungen, Line-ups, Menükarten oder Besonderheiten zu genau dieser Veranstaltung. Da die Texte dynamisch über das CMS oder die Datenstruktur geladen werden können, bietet dieses Layout die perfekte Bühne für alle wichtigen Details.)"}
              </p>
              
              <div className="my-12 p-8 bg-white border border-border-light rounded-2xl shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-2 h-full bg-accent-green"></div>
                 <h3 className="font-display font-bold text-xl mb-2 text-base-dark">
                    {locale === "en" ? "Table Reservation & Inquiries" : "Tischreservierung & Anfragen"}
                 </h3>
                 
                 {event.reservable ? (
                   <>
                     <p className="text-sm text-base-dark/70 mb-6">
                       {locale === "en" ? "You can reserve tables including consumption packages online for this event!" : "Für dieses Event kannst du Tische inkl. Verzehrpakete direkt online reservieren!"}
                     </p>
                     <a href="#reservation" className="inline-block px-8 py-3 bg-accent-green text-white font-bold rounded-xl hover:bg-base-dark transition-colors">
                       {locale === "en" ? "Reserve online now" : "Jetzt online reservieren"}
                     </a>
                   </>
                 ) : (
                   <>
                     <p className="text-sm text-base-dark/70 mb-6">
                       {locale === "en" ? "For larger groups we recommend a timely inquiry via our contact form." : "Für größere Gruppen empfehlen wir eine rechtzeitige Anfrage über unser Kontaktformular."}
                     </p>
                     <Link href="/#contact" className="inline-block px-8 py-3 bg-accent-green text-white font-bold rounded-xl hover:bg-base-dark transition-colors">
                       {locale === "en" ? "Inquire now" : "Jetzt anfragen"}
                     </Link>
                   </>
                 )}
              </div>
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
    </div>
  );
}
