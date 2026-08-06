"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getTables, getBookedTableIds } from "@/app/actions/tables";
import { joinWaitlist } from "@/app/actions/waitlist";

export default function ReservationSection({ initialEvents, initialSelectedEvent }: { initialEvents: any[], initialSelectedEvent?: string }) {
  const t = useTranslations("Reservation");
  const reservableEvents = initialEvents.filter((e: any) => e.reservable);

  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(initialSelectedEvent || "");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  
  const [tables, setTables] = useState<any[]>([]);
  const [bookedTableIds, setBookedTableIds] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  
  const [guests, setGuests] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState("");
  
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const selectedEventObj = reservableEvents.find((e: any) => e.id === selectedEvent);
  const isCountdown = selectedEventObj?.publishTablesAt && new Date(selectedEventObj.publishTablesAt) > new Date();

  useEffect(() => {
    async function loadTables() {
      const tbs = await getTables();
      setTables(tbs);
    }
    loadTables();
  }, []);

  useEffect(() => {
    async function loadBooked() {
      if (selectedEvent && selectedDate) {
        const booked = await getBookedTableIds(selectedEvent, selectedDate);
        setBookedTableIds(booked);
      }
    }
    loadBooked();
  }, [selectedEvent, selectedDate]);

  useEffect(() => {
    if (selectedTableId) {
      const tb = tables.find(t => t.id === selectedTableId);
      if (tb) {
        setGuests(tb.capacity);
      }
    }
  }, [selectedTableId, tables]);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          tableId: selectedTableId,
          reservationDate: selectedDate || selectedEventObj?.date,
          selectedTime: selectedTime,
          guestCount: guests,
          name: guestName,
          email: guestEmail,
          selectedPackage: selectedPackage
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

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);
    setCheckoutError("");
    const res = await joinWaitlist({
      eventId: selectedEvent,
      name: guestName,
      email: guestEmail,
      guestCount: guests
    });
    if (res.success) {
      setWaitlistSuccess(true);
    } else {
      setCheckoutError(res.error || "Ein Fehler ist aufgetreten.");
    }
    setIsCheckingOut(false);
  };

  const times = ["17:00 Uhr", "18:00 Uhr", "19:00 Uhr"];
  
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

  const selectedTableObj = tables.find(t => t.id === selectedTableId);
  let minimumConsumption = selectedEventObj?.minimumConsumption || 5000;
  let amountTotal = (minimumConsumption / 100) * guests;
  if (selectedTableObj?.isVip) {
    amountTotal += (selectedTableObj.vipPrice || 0) / 100;
  }

  // Calculate grid bounds
  const maxX = tables.length > 0 ? Math.max(...tables.map(t => t.positionX)) : 0;
  const maxY = tables.length > 0 ? Math.max(...tables.map(t => t.positionY)) : 0;

  return (
    <section id="reservation" className="w-full bg-base-light text-base-dark py-16 md:py-24 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">
          <polygon points="100,0 100,100 0,100" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10">
        
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
        </div>

        {/* Reservation Wizard */}
        <div className="bg-white border border-border-light rounded-3xl p-6 md:p-12 shadow-xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            
            {/* Left Column: Form & Layout */}
            <div className="lg:col-span-8 space-y-10">
              
              {/* Step 1: Wann */}
              <div className={step >= 1 ? "opacity-100" : "opacity-50 pointer-events-none"}>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">1</span>
                  Event & Datum
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('select_event')}</label>
                    <div className="grid grid-cols-1 gap-3">
                      {reservableEvents.map((event: any) => {
                        const dateObj = new Date(event.date);
                        const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        return (
                          <button 
                            key={event.id}
                            onClick={() => { setSelectedEvent(event.id); setSelectedDate(""); setSelectedTableId(""); setStep(1); }}
                            className={`py-3 px-4 text-sm font-bold rounded-xl border transition-all text-left flex justify-between items-center ${selectedEvent === event.id ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
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
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Wähle einen Tag</label>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedEventObj.reservableDates.map((day: string) => {
                          const d = new Date(day);
                          const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                          return (
                            <button 
                              key={day}
                              onClick={() => { setSelectedDate(day); setSelectedTableId(""); setStep(2); }}
                              className={`py-2 px-3 text-sm font-bold rounded-xl border transition-all text-center ${selectedDate === day ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                            >
                              {dayStr}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Zelt-Layout */}
              {(selectedEventObj && selectedEventObj.allowTableSelection !== false && (!selectedEventObj.reservableDates?.length || selectedDate)) && (
                <div className={step >= 1 ? "opacity-100 animate-fade-in" : "opacity-50 pointer-events-none hidden"}>
                  <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">2</span>
                    Tisch auswählen
                  </h3>

                  {isCountdown ? (
                    <div className="bg-canvas-light p-8 rounded-2xl text-center border border-border-light">
                      <h4 className="text-xl font-bold mb-2">Reservierungen noch nicht freigeschaltet</h4>
                      <p className="text-base-dark/70 mb-4">Die Tischauswahl öffnet sich am {new Date(selectedEventObj.publishTablesAt!).toLocaleString('de-DE')}.</p>
                    </div>
                  ) : (
                    <div className="bg-canvas-light p-6 rounded-2xl border border-border-light overflow-x-auto">
                      <div 
                        className="relative min-w-max mx-auto p-4" 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${maxX + 1}, minmax(80px, 1fr))`,
                          gridTemplateRows: `repeat(${maxY + 1}, minmax(60px, 1fr))`,
                          gap: '12px'
                        }}
                      >
                        {tables.map(table => {
                          const isBooked = bookedTableIds.includes(table.id);
                          const isSelected = selectedTableId === table.id;
                          
                          let bg = isBooked ? 'bg-red-100 border-red-300 text-red-500 opacity-60 cursor-not-allowed' 
                                 : isSelected ? 'bg-accent-green border-accent-green text-white shadow-lg scale-105' 
                                 : table.isVip ? 'bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100'
                                 : 'bg-white border-border-light text-base-dark hover:border-accent-green';

                          return (
                            <button
                              key={table.id}
                              disabled={isBooked}
                              onClick={() => { setSelectedTableId(table.id); setStep(3); }}
                              style={{ gridColumn: table.positionX + 1, gridRow: table.positionY + 1 }}
                              className={`border-2 rounded-xl p-2 transition-all flex flex-col items-center justify-center font-bold text-xs ${bg}`}
                            >
                              <span className="mb-1">{table.name}</span>
                              <span className="text-[10px] opacity-80">{table.capacity} Pers.</span>
                              {table.isVip && !isBooked && <span className="text-[10px] mt-1 bg-yellow-400 text-yellow-900 px-1 rounded">VIP</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex gap-4 text-xs font-bold text-base-dark/60 justify-center">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-border-light rounded-sm"></div> Frei</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-50 border border-yellow-400 rounded-sm"></div> VIP (+Aufpreis)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm"></div> Belegt</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-accent-green rounded-sm"></div> Gewählt</div>
                      </div>
                      <div className="mt-6 text-center">
                        <button 
                          onClick={() => setIsWaitlistMode(true)}
                          className="text-sm font-bold text-base-dark/60 underline hover:text-accent-green transition-colors"
                        >
                          {t('waitlist_btn')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Zeit & Paket */}
              {(selectedTableId || (selectedEventObj && selectedEventObj.allowTableSelection === false && (!selectedEventObj.reservableDates?.length || selectedDate))) && (
                <div className={(step >= 3 || selectedEventObj?.allowTableSelection === false) ? "opacity-100 animate-fade-in" : "opacity-50 pointer-events-none hidden"}>
                  <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-accent-green text-base-dark flex items-center justify-center text-sm font-black">
                      {selectedEventObj?.allowTableSelection === false ? "2" : "3"}
                    </span>
                    Uhrzeit & Paket
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Uhrzeit</label>
                      <div className="grid grid-cols-3 gap-2">
                        {times.map(time => (
                          <button 
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${selectedTime === time ? 'bg-accent-green text-white border-accent-green shadow-md' : 'border-border-light hover:border-accent-green/50 bg-white'}`}
                          >
                            {time.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Gästezahl (Max {selectedTableObj?.capacity})</label>
                      <div className="flex items-center gap-4 bg-base-light border border-border-light rounded-xl p-1">
                        <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-border-light transition-colors rounded-lg text-xl">-</button>
                        <span className="flex-1 text-center font-bold text-lg text-base-dark">{guests}</span>
                        <button onClick={() => setGuests(Math.min(selectedTableObj?.capacity || 100, guests + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-border-light transition-colors rounded-lg text-xl">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
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
              )}

            </div>

            {/* Right Column: Summary & Checkout */}
            <div className="lg:col-span-4 bg-canvas-light border border-border-light shadow-sm rounded-3xl p-6 md:p-8 flex flex-col sticky top-24 h-fit">
              <h3 className="text-2xl font-bold mb-8 border-b border-border-light pb-6 text-base-dark">{t('summary')}</h3>
              
              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center">
                  <span className="opacity-70">{t('event_time')}</span>
                  <span className="font-bold text-right">
                    {selectedEvent ? selectedEventObj?.title : "-"} <br/> 
                    <span className="opacity-70 font-normal text-sm">
                      {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}) : "-"} | {selectedTime || "-"}
                    </span>
                  </span>
                </div>
                {selectedEventObj?.allowTableSelection !== false && (
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Tisch</span>
                    <span className="font-bold">{selectedTableObj ? selectedTableObj.name : "-"}</span>
                  </div>
                )}
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

                {selectedTableObj?.isVip && (
                  <div className="flex justify-between items-center text-yellow-600 bg-yellow-50 p-2 rounded-lg text-sm">
                    <span className="font-bold">VIP Aufpreis</span>
                    <span className="font-bold">{(selectedTableObj.vipPrice || 0) / 100}€</span>
                  </div>
                )}

                {selectedPackage && (
                  <div className="space-y-4 pt-6 border-t border-border-light animate-fade-in">
                    <div>
                      <label className="block text-sm font-bold opacity-70 mb-2 text-base-dark">{t('name_label')}</label>
                      <input 
                        type="text" 
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Max Mustermann"
                        className="w-full bg-white border border-border-light rounded-xl px-4 py-3 text-sm text-base-dark focus:border-accent-green focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold opacity-70 mb-2 text-base-dark">{t('email_label')}</label>
                      <input 
                        type="email" 
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="max@beispiel.de"
                        className="w-full bg-white border border-border-light rounded-xl px-4 py-3 text-sm text-base-dark focus:border-accent-green focus:outline-none transition-colors"
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
                  <span className="text-sm font-bold">{t('total_amount')} <br/><span className="text-xs font-normal opacity-50">{t('voucher_hint')}</span></span>
                  <span className="text-3xl font-black text-accent-green">
                    {selectedPackage ? amountTotal + ((packages.find(p => p.id === selectedPackage)?.price || 0) * guests) - (minimumConsumption/100 * guests) : amountTotal}€
                  </span>
                </div>

                <button 
                  disabled={(!selectedTableId && selectedEventObj?.allowTableSelection !== false) || !selectedTime || !selectedPackage || !guestName || !guestEmail || isCheckingOut}
                  onClick={handleCheckout}
                  className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-sm"
                >
                  {isCheckingOut ? t('submitting') : t('submit_btn')}
                </button>
              </div>
            </div>

            {/* Waitlist Modal overlay */}
            {isWaitlistMode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-dark/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full shadow-2xl relative">
                  <button onClick={() => setIsWaitlistMode(false)} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-canvas-light hover:bg-border-light font-bold text-xl transition-colors">×</button>
                  
                  {waitlistSuccess ? (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-3xl font-black mb-2">{t('waitlist_success').split('!')[0]}!</h3>
                      <p className="text-base-dark/70 mb-8">{t('waitlist_success').split('!')[1]}</p>
                      <button onClick={() => {setIsWaitlistMode(false); setWaitlistSuccess(false);}} className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold">Schließen</button>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlist} className="space-y-6">
                      <h3 className="text-3xl font-black mb-2">{t('waitlist_title')}</h3>
                      <p className="text-base-dark/70 text-sm mb-6">{t('waitlist_desc')}</p>
                      
                      {checkoutError && <div className="text-red-500 bg-red-50 p-3 rounded-lg text-sm font-bold">{checkoutError}</div>}

                      <div>
                        <label className="block text-sm font-bold mb-1">{t('name_label')}</label>
                        <input required type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full border rounded-xl px-4 py-3 bg-canvas-light" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">{t('email_label')}</label>
                        <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full border rounded-xl px-4 py-3 bg-canvas-light" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">{t('persons')}</label>
                        <input required type="number" min={1} value={guests} onChange={e => setGuests(parseInt(e.target.value) || 1)} className="w-full border rounded-xl px-4 py-3 bg-canvas-light" />
                      </div>

                      <button disabled={isCheckingOut} type="submit" className="w-full bg-accent-green text-white font-bold py-4 rounded-xl disabled:opacity-50">
                        {isCheckingOut ? t('submitting') : t('waitlist_submit')}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </section>
  );
}
