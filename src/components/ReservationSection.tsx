"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ReservationSection({ initialEvents, initialSelectedEvent }: { initialEvents: any[], initialSelectedEvent?: string }) {
  const t = useTranslations("Reservation");
  const reservableEvents = initialEvents.filter((e: any) => e.reservable);

  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(initialSelectedEvent || "");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(4);
  const [selectedPackage, setSelectedPackage] = useState("");
  
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          reservationDate: selectedDate || reservableEvents.find((e: any) => e.id === selectedEvent)?.date,
          guestCount: guests,
          name: guestName,
          email: guestEmail
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || t('error_checkout'));
      }
    } catch (err) {
      setCheckoutError(t('error_connection'));
    } finally {
      setIsCheckingOut(false);
    }
  };

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
    <section id="reservation" className="w-full bg-base-light text-base-dark py-16 md:py-24 relative overflow-hidden">
      
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
            className="text-4xl md:text-5xl lg:text-7xl font-black text-base-dark uppercase tracking-tighter mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('title_1_alt')} <span className="text-accent-green">{t('title_2_alt')}</span>
          </motion.h2>
          <motion.p 
            className="text-lg md:text-xl text-base-dark/80 leading-relaxed font-sans"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* Reservation Wizard */}
        <div className="bg-white border border-border-light rounded-3xl p-6 md:p-12 shadow-xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            
            {/* Left Column: Form */}
            <div className="space-y-10">
              
              {/* Step 1: Wann & Wer */}
              <div className={step === 1 ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">1</span>
                  {t('step_1')}
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('select_event')}</label>
                    <div className="grid grid-cols-1 gap-3">
                      {initialSelectedEvent ? (
                        <div className="py-3 px-4 text-sm font-bold rounded-xl border bg-accent-green/10 text-base-dark border-accent-green/30 opacity-80 cursor-not-allowed flex justify-between items-center">
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
                              className={`py-3 px-4 text-sm font-bold rounded-xl border transition-all text-left flex justify-between items-center ${selectedEvent === event.id ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                            >
                              <span>{event.title}</span>
                              <span className="opacity-70 text-xs font-normal">{dateStr}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Date Selection */}
                  {selectedEvent && reservableEvents.find((e: any) => e.id === selectedEvent)?.reservableDates?.length > 0 && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Wähle einen Tag</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {reservableEvents.find((e: any) => e.id === selectedEvent)?.reservableDates.map((day: string) => {
                          const d = new Date(day);
                          const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                          return (
                            <button 
                              key={day}
                              onClick={() => { setSelectedDate(day); if(selectedTime && guests) setStep(2); }}
                              className={`py-2 px-3 text-sm font-bold rounded-xl border transition-all text-center ${selectedDate === day ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                            >
                              {dayStr}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('step_2').split('.')[1]?.trim() || t('step_2')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {times.map(time => (
                          <button 
                            key={time}
                            onClick={() => { setSelectedTime(time); if(selectedEvent && (selectedDate || !reservableEvents.find((e: any) => e.id === selectedEvent)?.reservableDates?.length) && guests) setStep(2); }}
                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${selectedTime === time ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                          >
                            {time.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('persons')}</label>
                      <div className="flex items-center gap-4 bg-base-light border border-border-light rounded-xl p-1">
                        <button onClick={() => setGuests(Math.max(2, guests - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-border-light transition-colors rounded-lg text-xl">-</button>
                        <span className="flex-1 text-center font-bold text-lg text-base-dark">{guests}</span>
                        <button onClick={() => setGuests(Math.min(10, guests + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-border-light transition-colors rounded-lg text-xl">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Wertmarken */}
              <div className={step === 2 ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">2</span>
                  {t('step_3').split('.')[1]?.trim() || t('step_3')}
                </h3>
                
                <div className="space-y-4">
                  {packages.map(pkg => (
                    <button 
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all relative ${selectedPackage === pkg.id ? 'bg-accent-green/10 border-accent-green shadow-sm' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-3 right-4 bg-accent-green text-base-dark text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full">
                          {t('popular')}
                        </span>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg text-base-dark">{pkg.name}</h4>
                        <span className="font-black text-accent-green">{pkg.price}€ <span className="text-xs font-normal opacity-70 text-base-dark">p.P.</span></span>
                      </div>
                      <p className="text-sm text-base-dark/70 leading-relaxed">{pkg.description}</p>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Summary & Checkout */}
            <div className="bg-canvas-light border border-border-light shadow-sm rounded-3xl p-8 flex flex-col">
              <h3 className="text-2xl font-bold mb-8 border-b border-border-light pb-6 text-base-dark">{t('summary')}</h3>
              
              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center">
                  <span className="opacity-70">{t('event_time')}</span>
                  <span className="font-bold text-right">
                    {selectedEvent ? reservableEvents.find(e => e.id === selectedEvent)?.title : "-"} <br className="md:hidden"/> 
                    <span className="opacity-70 font-normal">| {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}) : "-"} | {selectedTime || "-"}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">{t('guests')}</span>
                  <span className="font-bold">{guests} {t('persons')}</span>
                </div>
                <div className="flex justify-between items-start mb-6">
                  <span className="opacity-70">{t('consumption_package')}</span>
                  <div className="text-right">
                    <span className="font-bold block">{selectedPackage ? packages.find(p => p.id === selectedPackage)?.name : "-"}</span>
                    {selectedPackage && (
                      <span className="text-sm opacity-70">{guests} x {packages.find(p => p.id === selectedPackage)?.price}€</span>
                    )}
                  </div>
                </div>

                {selectedPackage && (
                  <div className="space-y-4 pt-6 border-t border-border-light animate-fade-in">
                    <div>
                      <label className="block text-sm font-bold opacity-70 mb-2 text-base-dark">{t('name_label')}</label>
                      <input 
                        type="text" 
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Max Mustermann"
                        className="w-full bg-white border border-border-light rounded-xl px-4 py-3 text-base-dark focus:border-accent-green focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold opacity-70 mb-2 text-base-dark">{t('email_label')}</label>
                      <input 
                        type="email" 
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="max@beispiel.de"
                        className="w-full bg-white border border-border-light rounded-xl px-4 py-3 text-base-dark focus:border-accent-green focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-border-light">
                {checkoutError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm">
                    {checkoutError}
                  </div>
                )}
                
                <div className="flex justify-between items-end mb-8">
                  <span className="text-lg font-bold">{t('total_amount')} <br/><span className="text-xs font-normal opacity-50">{t('voucher_hint')}</span></span>
                  <span className="text-4xl font-black text-accent-green">
                    {selectedPackage ? (packages.find(p => p.id === selectedPackage)?.price || 0) * guests : 0}€
                  </span>
                </div>

                <button 
                  disabled={!selectedEvent || !selectedTime || !selectedPackage || !guestName || !guestEmail || isCheckingOut}
                  onClick={handleCheckout}
                  className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isCheckingOut ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('submitting')}
                    </>
                  ) : t('submit_btn')}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
