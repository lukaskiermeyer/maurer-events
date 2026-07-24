"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export default function ReservationSection({ initialEvents, initialSelectedEvent }: { initialEvents: any[], initialSelectedEvent?: string }) {
  const reservableEvents = initialEvents.filter((e: any) => e.reservable);

  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(initialSelectedEvent || "");
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(4);
  const [selectedPackage, setSelectedPackage] = useState("");

  const times = ["17:00 Uhr", "18:00 Uhr", "19:00 Uhr"];
  
  // ... packages unchanged
  const packages = [
    {
      id: "brotzeit",
      name: "Brotzeit-Paket",
      price: 25,
      description: "Perfekt für den Start. Beinhaltet 1 Maß Bier & 1 halbes Hendl pro Person.",
    },
    {
      id: "vollgas",
      name: "Vollgas-Paket",
      price: 50,
      description: "Für den großen Durst. Beinhaltet 2 Maß Bier, 1 Hauptgericht & 1 Schnaps pro Person.",
      popular: true,
    }
  ];

  return (
    <section id="reservation" className="w-full bg-base-dark text-canvas-light py-24 md:py-32 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">
          <polygon points="100,0 100,100 0,100" />
        </svg>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.h2 
            className="text-4xl md:text-5xl lg:text-7xl font-black text-white uppercase tracking-tighter mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Tisch <span className="text-accent-green">Reservieren</span>
          </motion.h2>
          <motion.p 
            className="text-lg md:text-xl opacity-80 leading-relaxed font-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Wir verzichten auf unfaire Tischgebühren! Bei uns kaufst du lediglich ein Verzehrpaket vorab, das du zu 100% am Abend einlösen kannst. Fair für dich, Planungssicherheit für uns.
          </motion.p>
        </div>

        {/* Reservation Wizard */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-12 backdrop-blur-sm">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            
            {/* Left Column: Form */}
            <div className="space-y-10">
              
              {/* Step 1: Wann & Wer */}
              <div className={step === 1 ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">1</span>
                  Welches Event & Wie viele?
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Event wählen</label>
                    <div className="grid grid-cols-1 gap-3">
                      {initialSelectedEvent ? (
                        <div className="py-3 px-4 text-sm font-bold rounded-xl border bg-accent-green/20 text-white border-accent-green/50 opacity-80 cursor-not-allowed flex justify-between items-center">
                          <span>{reservableEvents.find((e: any) => e.id === initialSelectedEvent)?.title || "Ausgewähltes Event"}</span>
                          <span className="opacity-70 text-xs font-normal">Vorausgewählt</span>
                        </div>
                      ) : (
                        reservableEvents.map((event: any) => {
                          const dateObj = new Date(event.date);
                          const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          return (
                            <button 
                              key={event.id}
                              onClick={() => { setSelectedEvent(event.id); if(selectedTime && guests) setStep(2); }}
                              className={`py-3 px-4 text-sm font-bold rounded-xl border transition-all text-left flex justify-between items-center ${selectedEvent === event.id ? 'bg-accent-green text-base-dark border-accent-green' : 'border-white/20 hover:border-accent-green/50'}`}
                            >
                              <span>{event.title}</span>
                              <span className="opacity-70 text-xs font-normal">{dateStr}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Uhrzeit</label>
                      <div className="grid grid-cols-3 gap-2">
                        {times.map(time => (
                          <button 
                            key={time}
                            onClick={() => { setSelectedTime(time); if(selectedEvent && guests) setStep(2); }}
                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${selectedTime === time ? 'bg-accent-green text-base-dark border-accent-green' : 'border-white/20 hover:border-accent-green/50'}`}
                          >
                            {time.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Personen</label>
                      <div className="flex items-center gap-4 bg-white/5 border border-white/20 rounded-xl p-1">
                        <button onClick={() => setGuests(Math.max(2, guests - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg text-xl">-</button>
                        <span className="flex-1 text-center font-bold text-lg">{guests}</span>
                        <button onClick={() => setGuests(Math.min(10, guests + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg text-xl">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Wertmarken */}
              <div className={step === 2 ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">2</span>
                  Verzehrpaket wählen
                </h3>
                
                <div className="space-y-4">
                  {packages.map(pkg => (
                    <button 
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all relative ${selectedPackage === pkg.id ? 'bg-accent-green/10 border-accent-green' : 'border-white/20 hover:border-accent-green/50'}`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-3 right-4 bg-accent-green text-base-dark text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full">
                          Beliebt
                        </span>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{pkg.name}</h4>
                        <span className="font-black text-accent-green">{pkg.price}€ <span className="text-xs font-normal opacity-70 text-white">p.P.</span></span>
                      </div>
                      <p className="text-sm opacity-70 leading-relaxed">{pkg.description}</p>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Summary & Checkout */}
            <div className="bg-base-dark/50 border border-white/10 rounded-3xl p-8 flex flex-col">
              <h3 className="text-2xl font-bold mb-8 border-b border-white/10 pb-6">Zusammenfassung</h3>
              
              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center">
                  <span className="opacity-70">Event & Zeit</span>
                  <span className="font-bold text-right">
                    {selectedEvent ? reservableEvents.find(e => e.id === selectedEvent)?.title : "-"} <br className="md:hidden"/> 
                    <span className="opacity-70 font-normal">| {selectedTime || "-"}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">Gäste</span>
                  <span className="font-bold">{guests} Personen</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="opacity-70">Verzehrpaket</span>
                  <div className="text-right">
                    <span className="font-bold block">{selectedPackage ? packages.find(p => p.id === selectedPackage)?.name : "-"}</span>
                    {selectedPackage && (
                      <span className="text-sm opacity-70">{guests} x {packages.find(p => p.id === selectedPackage)?.price}€</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex justify-between items-end mb-8">
                  <span className="text-lg font-bold">Gesamtbetrag <br/><span className="text-xs font-normal opacity-50">(100% als Gutschein)</span></span>
                  <span className="text-4xl font-black text-accent-green">
                    {selectedPackage ? (packages.find(p => p.id === selectedPackage)?.price || 0) * guests : 0}€
                  </span>
                </div>

                <button 
                  disabled={!selectedEvent || !selectedTime || !selectedPackage}
                  className="w-full bg-accent-green text-base-dark font-black uppercase tracking-widest py-4 rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Jetzt verbindlich reservieren
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
