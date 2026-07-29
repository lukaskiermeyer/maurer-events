import React from "react";
import { getEvents } from "@/app/actions/events";
import Link from "next/link";

export const runtime = 'edge';

export const metadata = {
  title: "Alle Termine | MAURER EVENTS",
};

export default async function TermineOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const upcomingEvents = await getEvents();
  return (
    <div className="py-32 px-4 sm:px-8 lg:px-16 max-w-[1600px] mx-auto min-h-screen bg-base-light">
      <div className="max-w-3xl mb-16">
        <h1 className="font-display font-black text-5xl md:text-7xl mb-6 text-base-dark">
          {locale === "en" ? "Our" : "Unsere"} <span className="text-accent-wood">{locale === "en" ? "Events" : "Termine"}</span>
        </h1>
        <p className="font-sans text-xl text-base-dark/70">
          {locale === "en" 
            ? "Here you can find an overview of all upcoming events. Come by, celebrate with us, and experience modern Bavarian hospitality."
            : "Hier findest du eine Übersicht aller anstehenden Veranstaltungen. Komm vorbei, feiere mit uns und erlebe moderne bayerische Gastfreundschaft."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {upcomingEvents.map((event) => {
          const dateObj = new Date(event.date);
          const dateStr = dateObj.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });

          const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
          const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
          const location = locale === "en" && event.locationEn ? event.locationEn : event.location;

          return (
            <Link href={`/termine/${event.id}`} key={event.id} className="group flex flex-col h-full bg-canvas-light border border-border-light rounded-3xl overflow-hidden hover:border-accent-wood transition-colors hover:shadow-xl relative">
              <div className="p-8 bg-border-light/30 border-b border-border-light group-hover:bg-accent-wood/10 transition-colors relative overflow-hidden min-h-[160px] flex flex-col justify-end">
                {event.imageUrl && (
                  <div className="absolute inset-0 bg-cover bg-center opacity-50 group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${event.imageUrl})` }}></div>
                )}
                <div className="relative z-10">
                  <span className="text-accent-wood font-bold text-xs tracking-widest uppercase mb-1 block drop-shadow-sm">{locale === "en" ? "Date" : "Datum"}</span>
                  <span className="font-display font-bold text-3xl text-base-dark drop-shadow-md">{dateStr}</span>
                </div>
              </div>
              
              <div className="p-8 flex-grow flex flex-col">
                <h3 className="font-display font-bold text-2xl mb-4 text-base-dark">{title}</h3>
                <p className="font-sans text-base-dark/70 mb-6 flex-grow">{description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm font-bold text-accent-wood">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                  </div>
                  
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-accent-wood group-hover:bg-accent-wood group-hover:text-white transition-colors shadow-sm">
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
