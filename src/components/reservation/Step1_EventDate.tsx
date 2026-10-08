"use client";

import type { ReservationEvent } from '@/types/domain';

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Step1_EventDate({
  reservableEvents,
  selectedEvent,
  selectedDate,
  setSelectedEvent,
  setSelectedDate,
  selectedEventObj,
  windowError
}: {
  reservableEvents: ReservationEvent[];
  selectedEvent: string;
  selectedDate: string;
  setSelectedEvent: (id: string) => void;
  setSelectedDate: (date: string) => void;
  selectedEventObj: ReservationEvent | undefined;
  windowError?: string;
}) {
  const t = useTranslations("Reservation");

  // Auto-select date when event has no reservableDates (use event.date) or exactly one date
  useEffect(() => {
    let automaticDate = '';
    if (selectedEventObj && (!selectedEventObj.reservableDates || selectedEventObj.reservableDates.length === 0)) {
      // No selectable dates — auto-fill with the event's own date
      if (selectedEventObj.date) {
        const dateStr = typeof selectedEventObj.date === 'string' 
          ? selectedEventObj.date.split('T')[0] 
          : new Date(selectedEventObj.date).toISOString().split('T')[0];
        automaticDate = dateStr;
      }
    } else if (selectedEventObj?.reservableDates?.length === 1) {
      automaticDate = selectedEventObj.reservableDates[0];
    }
    if (automaticDate && automaticDate !== selectedDate) setSelectedDate(automaticDate);
  }, [selectedEventObj, selectedDate, setSelectedDate]);

  if (reservableEvents.length === 0) {
    return (
      <div className="animate-fade-in">
        <h3 className="text-2xl font-bold mb-6 text-base-dark">Event & Datum</h3>
        <div className="bg-canvas-light border border-border-light rounded-2xl p-10 text-center">
          <div className="w-16 h-16 bg-base-dark/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-base-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-bold text-base-dark mb-2">Aktuell keine Events verfügbar</h4>
          <p className="text-base-dark/60 text-sm">Schau bald wieder vorbei – neue Events werden regelmäßig veröffentlicht.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold mb-6 text-base-dark">Event & Datum</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label id="event-label" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('select_event')}</label>
          <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-labelledby="event-label">
            {reservableEvents.map((event) => {
              const dateObj = new Date(event.date);
              const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
              return (
                <button 
                  key={event.id}
                  onClick={() => setSelectedEvent(event.id)}
                  role="radio"
                  aria-checked={selectedEvent === event.id}
                  className={`min-h-[56px] py-3 px-4 text-sm font-bold rounded-xl border transition-all text-left flex justify-between items-center ${selectedEvent === event.id ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white text-base-dark'}`}
                >
                  <span>{event.title}</span>
                  <span className="opacity-70 text-xs font-normal">{dateStr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Selection */}
        {selectedEventObj && selectedEventObj.reservableDates?.length > 0 && (
          <div className="animate-fade-in">
            <label id="date-label" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Wähle einen Tag</label>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby="date-label">
              {selectedEventObj.reservableDates.map((day: string) => {
                const d = new Date(day);
                const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                return (
                  <button 
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    role="radio"
                    aria-checked={selectedDate === day}
                    className={`min-h-[56px] py-2 px-3 text-sm font-bold rounded-xl border transition-all text-center ${selectedDate === day ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white text-base-dark'}`}
                  >
                    {dayStr}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {windowError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start animate-fade-in">
          <span className="text-red-500 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <p className="text-sm font-bold text-red-800">{windowError}</p>
        </div>
      )}
    </div>
  );
}
