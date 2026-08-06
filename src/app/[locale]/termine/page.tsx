import React from "react";
import { getEvents } from "@/app/actions/events";
import { Link } from "@/i18n/routing";

export const metadata = {
  title: "Alle Termine & Events | MAURER EVENTS",
  description: "Übersicht aller anstehenden Zeltfeste und Veranstaltungen von Maurer Events. Komm vorbei und feiere mit uns in echter bayerischer Atmosphäre.",
};

export default async function TermineOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const upcomingEvents = await getEvents();
  return (
    <div className="py-32 px-4 sm:px-8 lg:px-16 max-w-[1600px] mx-auto min-h-screen bg-base-light relative overflow-hidden">
      
      {/* Subtle Background Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-accent-green/5 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-accent-green/5 blur-3xl pointer-events-none"></div>

      <div className="max-w-3xl mb-16 relative z-10">
        <h1 className="font-display font-black text-5xl md:text-7xl mb-6 text-base-dark">
          {locale === "en" ? "Our" : "Unsere"} <span className="text-accent-green">{locale === "en" ? "Events" : "Termine"}</span>
        </h1>
        <p className="font-sans text-xl text-base-dark/70">
          {locale === "en" 
            ? "Here you can find an overview of all upcoming events. Come by, celebrate with us, and experience modern Bavarian hospitality."
            : "Hier findest du eine Übersicht aller anstehenden Veranstaltungen. Komm vorbei, feiere mit uns und erlebe moderne bayerische Gastfreundschaft."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        {upcomingEvents.map((event) => {
          const dateObj = new Date(event.date);
          const day = dateObj.getDate().toString().padStart(2, '0');
          const monthNamesDe = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
          const monthNamesEn = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const month = locale === 'en' ? monthNamesEn[dateObj.getMonth()] : monthNamesDe[dateObj.getMonth()];
          const year = dateObj.getFullYear();

          const title = locale === "en" && event.titleEn ? event.titleEn : event.title;
          const description = locale === "en" && event.descriptionEn ? event.descriptionEn : event.description;
          const location = locale === "en" && event.locationEn ? event.locationEn : event.location;

          return (
            <Link href={`/termine/${event.id}`} key={event.id} className="group bg-white border border-border-light rounded-2xl flex flex-col sm:flex-row sm:items-stretch relative hover:border-accent-green hover:shadow-xl transition-all duration-300 overflow-hidden block">
              <div className="sm:w-1/3 p-6 sm:p-8 bg-border-light/30 group-hover:bg-accent-green group-hover:text-white transition-colors flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-border-light relative overflow-hidden">
                {event.imageUrl && (
                  <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-20 group-hover:scale-105 transition-all duration-700" style={{ backgroundImage: `url(${event.imageUrl})` }}></div>
                )}
                <div className="relative z-10 flex items-baseline gap-2 sm:flex-col sm:gap-0">
                  <span className="font-display font-black text-4xl sm:text-5xl text-base-dark group-hover:text-white transition-colors">{day}.</span>
                  <div className="flex sm:flex-col items-baseline gap-1 sm:gap-0">
                    <span className="font-display font-bold text-lg sm:text-xl text-accent-green group-hover:text-white/90 transition-colors">{month}</span>
                    <span className="font-display text-sm sm:text-base text-base-dark/60 group-hover:text-white/80 transition-colors">{year}</span>
                  </div>
                </div>
              </div>
              
              <div className="sm:w-2/3 p-6 sm:p-8 flex flex-col">
                <h3 className="font-display font-bold text-2xl sm:text-3xl mb-2 text-base-dark">{title}</h3>
                {event.reservable && (
                  <span className="inline-block bg-base-dark text-white font-bold text-xs uppercase tracking-widest px-3 py-1 mb-4 shadow-md rounded-sm self-start">
                    {locale === 'en' ? "Tables reservable" : "Tische reservierbar"}
                  </span>
                )}
                <p className="font-sans text-sm sm:text-base text-base-dark/70 mb-6 flex-grow">{description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm font-bold text-accent-green">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                  </div>
                  
                  <div className="w-10 h-10 bg-canvas-light rounded-full flex items-center justify-center text-accent-green group-hover:bg-accent-green group-hover:text-white transition-colors shadow-sm border border-border-light">
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
