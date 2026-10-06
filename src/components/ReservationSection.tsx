"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { assertBookingWindow, bookingInstant, DEFAULT_PACKAGES, DEFAULT_TIMES } from '@/lib/reservation-policy';
import { useTranslations } from "next-intl";
import { Turnstile } from "@marsidev/react-turnstile";
import { getTables, getBookedTableIds } from "@/app/actions/tables";
import { joinWaitlist } from "@/app/actions/waitlist";
import { getPublicEventSettings } from "@/app/actions/eventSettings";

// Import Wizard Steps
import Step1_EventDate from "./reservation/Step1_EventDate";
import Step2_TableSelection from "./reservation/Step2_TableSelection";
import Step3_TimePackage from "./reservation/Step3_TimePackage";
import Step4_Checkout from "./reservation/Step4_Checkout";
import SummaryPanel from "./reservation/SummaryPanel";

export default function ReservationSection({ initialEvents, initialSelectedEvent }: { initialEvents: any[], initialSelectedEvent?: string }) {
  const t = useTranslations("Reservation");
  const reservableEvents = initialEvents.filter((e: any) => e.reservable);

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(initialSelectedEvent || "");
  const [eventSettings, setEventSettings] = useState<any>(null);
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
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const checkoutAttempt = useRef<{ payload: string; key: string } | null>(null);
  const checkoutBusy = useRef(false);

  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistTurnstileToken, setWaitlistTurnstileToken] = useState("");
  const [waitlistCaptchaVersion, setWaitlistCaptchaVersion] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [isStep4Valid, setIsStep4Valid] = useState(false);
  const [isLoadingBookedTables, setIsLoadingBookedTables] = useState(false);

  const selectedEventObj = reservableEvents.find((e: any) => e.id === selectedEvent);
  // React Server Components preserve Date values passed from database records.
  const eventDay = selectedEventObj ? new Date(selectedEventObj.date).toISOString().slice(0, 10) : '';
  const isCountdown = selectedEventObj?.publishTablesAt && new Date(selectedEventObj.publishTablesAt) > new Date();

  const totalSteps = selectedEventObj?.allowTableSelection !== false ? 4 : 3;

  useEffect(() => {
    async function loadSettings() {
      if (selectedEvent) {
        const settings = await getPublicEventSettings(selectedEvent);
        if (active) setEventSettings(settings);
      } else {
        setEventSettings(null);
      }
    }
    let active = true;
    setEventSettings(null);
    loadSettings().catch(() => { if (active) setCheckoutError(t('error_connection')); });
    return () => { active = false; };
  }, [selectedEvent]);

  useEffect(() => {
    async function loadTables() {
      try { const tbs = await getTables(); if (active) setTables(tbs); }
      catch { if (active) setCheckoutError(t('error_connection')); }
    }
    let active = true;
    loadTables();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    async function loadBooked() {
      const date = selectedDate || eventDay;
      if (selectedEvent && date) {
        setIsLoadingBookedTables(true);
        try {
          const booked = await getBookedTableIds(selectedEvent, date);
          if (active) setBookedTableIds(booked);
        } catch { if (active) setCheckoutError(t('error_connection')); }
        finally { if (active) setIsLoadingBookedTables(false); }
      }
    }
    let active = true;
    setBookedTableIds([]);
    setIsLoadingBookedTables(false);
    loadBooked();
    return () => { active = false; };
  }, [selectedEvent, selectedDate, eventDay]);

  useEffect(() => {
    if (selectedTableId) {
      const tb = tables.find(t => t.id === selectedTableId);
      if (tb) {
        setGuests(tb.capacity);
      }
    }
  }, [selectedTableId, tables]);

  // Handle cascading resets when changing earlier steps
  const handleEventChange = (id: string) => {
    setSelectedEvent(id);
    setSelectedDate("");
    setSelectedTableId("");
    setSelectedTime("");
    setSelectedPackage("");
    setGuests(1);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTableId("");
    setSelectedTime("");
  };

  const windowMessage = () => {
    if (!selectedEventObj) return '';
    const day = selectedDate || eventDay;
    if (!day) return 'Bitte einen Tag auswählen.';
    try {
      const times = eventSettings?.timeSlots || DEFAULT_TIMES;
      const time = selectedTime || times[times.length - 1];
      assertBookingWindow(bookingInstant(day, time.slice(0, 5)), eventSettings?.bookingWindowStartDays, eventSettings?.bookingWindowEndHours);
      return '';
    } catch (error) { return error instanceof Error ? error.message : 'Datum nicht buchbar.'; }
  };
  const windowError = windowMessage();
  const canProceed = () => {
    if (!selectedEventObj || windowError) return false;
    if (currentStep === 1) return !selectedEventObj.reservableDates?.length || selectedDate !== '';
    if (currentStep === totalSteps) return isStep4Valid && turnstileToken !== '' && selectedTime !== '' && selectedPackage !== '';
    if (currentStep === 2 && selectedEventObj.allowTableSelection !== false) return selectedTableId !== '' && !isLoadingBookedTables;
    return selectedTime !== '' && selectedPackage !== '';
  };
  const handleNext = () => {
    if (canProceed() && currentStep < totalSteps) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: Math.max(0, (document.getElementById('reservation-wizard')?.offsetTop ?? 100) - 100), behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: Math.max(0, (document.getElementById('reservation-wizard')?.offsetTop ?? 100) - 100), behavior: 'smooth' });
    }
  };

  const handleCheckout = async () => {
    if (checkoutBusy.current) return;
    checkoutBusy.current = true;
    setIsCheckingOut(true);
    setCheckoutError("");

    if (!turnstileToken) {
      setCheckoutError("Bitte bestätige, dass du kein Roboter bist.");
      setIsCheckingOut(false);
      checkoutBusy.current = false;
      return;
    }

    const payload = { eventId: selectedEvent, tableId: selectedTableId || null,
      reservationDate: selectedDate || eventDay, selectedTime,
      guestCount: guests, name: guestName.trim(), email: guestEmail.trim().toLowerCase(), selectedPackage };
    const fingerprint = JSON.stringify(payload);
    let stored: string | null = null;
    try { stored = sessionStorage.getItem('reservation-checkout-attempt'); } catch { /* Storage is optional. */ }
    if (!checkoutAttempt.current && stored) {
      try { checkoutAttempt.current = JSON.parse(stored); } catch { sessionStorage.removeItem('reservation-checkout-attempt'); }
    }
    if (checkoutAttempt.current?.payload !== fingerprint || typeof checkoutAttempt.current?.key !== 'string') {
      checkoutAttempt.current = { payload: fingerprint, key: crypto.randomUUID() };
      try { sessionStorage.setItem('reservation-checkout-attempt', JSON.stringify(checkoutAttempt.current)); } catch { /* In-memory key still protects retries. */ }
    }
    const idempotencyKey = checkoutAttempt.current.key;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          turnstileToken: turnstileToken,
          idempotencyKey: idempotencyKey
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        setCheckoutError(t('error_connection') + " (Status: " + res.status + ")");
        setIsCheckingOut(false);
        return;
      }

      if (!res.ok) {
        if (data.code === 'new_attempt_allowed') {
          checkoutAttempt.current = null;
          try { sessionStorage.removeItem('reservation-checkout-attempt'); } catch { /* Optional storage. */ }
        }
        setCheckoutError(data.error || t('error_checkout'));
        setIsCheckingOut(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || t('error_checkout'));
      }
    } catch (err) {
      setCheckoutError(t('error_connection'));
    } finally {
      setIsCheckingOut(false);
      checkoutBusy.current = false;
      setTurnstileToken('');
      setCaptchaVersion(value => value + 1);
    }
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);
    setCheckoutError("");
    if (!waitlistTurnstileToken) {
      setCheckoutError("Bitte bestätige, dass du kein Roboter bist.");
      setIsCheckingOut(false);
      return;
    }

    try {
    const res = await joinWaitlist({
      eventId: selectedEvent,
      name: guestName,
      email: guestEmail,
      guestCount: guests,
      turnstileToken: waitlistTurnstileToken
    });
    if (res.success) {
      setWaitlistSuccess(true);
    } else {
      setCheckoutError(res.error || "Ein Fehler ist aufgetreten.");
    }
    } catch { setCheckoutError(t('error_connection')); }
    finally { setIsCheckingOut(false); setWaitlistTurnstileToken(''); setWaitlistCaptchaVersion(value => value + 1); }
  };

  const times = eventSettings?.timeSlots || DEFAULT_TIMES;

  const packages = eventSettings?.packages || DEFAULT_PACKAGES;

  const selectedTableObj = tables.find(t => t.id === selectedTableId);
  let minimumConsumption = eventSettings?.minConsumptionCents ?? (selectedEventObj?.minimumConsumption || 5000);
  let amountTotal = (minimumConsumption / 100) * guests;
  if (selectedTableObj?.isVip) {
    amountTotal += (selectedTableObj.vipPrice || 0) / 100;
  }

  return (
    <section id="reservation-wizard" className="w-full bg-base-light text-base-dark py-16 md:py-24 relative overflow-hidden">
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

        {/* Wizard Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">

          {/* Left: Wizard Steps */}
          <div className="lg:col-span-8">

            {/* Progress Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm py-4 -mx-6 px-6 md:-mx-10 md:px-10 -mt-6 md:-mt-10 mb-6 rounded-t-3xl lg:static lg:bg-transparent lg:backdrop-blur-none lg:py-0 lg:mx-0 lg:px-0 lg:mt-0 lg:mb-8">
              <div className="flex items-center justify-between max-w-lg mx-auto lg:mx-0">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
                <div key={stepNum} className="flex items-center w-full">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black transition-colors ${
                    currentStep >= stepNum ? 'bg-accent-green text-white shadow-md' : 'bg-canvas-light border-2 border-border-light text-base-dark/30'
                  }`}>
                    {stepNum}
                  </div>
                  {stepNum < totalSteps && (
                    <div className={`flex-1 h-1 mx-2 transition-colors rounded-full ${currentStep > stepNum ? 'bg-accent-green' : 'bg-canvas-light border border-border-light'}`} />
                  )}
                </div>
              ))}
              </div>
            </div>

            {/* Mobile Accordion Summary (Visible only on mobile) */}
            <div className="lg:hidden">
              <SummaryPanel
                selectedEventObj={selectedEventObj}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                selectedTableObj={selectedTableObj}
                guests={guests}
                selectedPackage={selectedPackage}
                packages={packages}
                amountTotal={amountTotal}
                minimumConsumption={minimumConsumption}
                customServiceFee={eventSettings?.customServiceFee}
                serviceFeePercent={eventSettings?.serviceFeePercent}
                serviceFeeFixedCents={eventSettings?.serviceFeeFixedCents}
              />
            </div>

            {/* Step Content */}
            <div className="bg-white border border-border-light rounded-3xl p-6 md:p-10 shadow-xl mb-24 lg:mb-0 overflow-hidden">

              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  initial={{ x: direction * 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction * -80, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  {currentStep === 1 && (
                    <Step1_EventDate
                      reservableEvents={reservableEvents}
                      selectedEvent={selectedEvent}
                      selectedDate={selectedDate}
                      setSelectedEvent={handleEventChange}
                      setSelectedDate={handleDateChange}
                      selectedEventObj={selectedEventObj}
                      windowError={windowError}
                    />
                  )}

                  {currentStep === 2 && selectedEventObj?.allowTableSelection !== false && (
                    <Step2_TableSelection
                      tables={tables}
                      bookedTableIds={bookedTableIds}
                      selectedTableId={selectedTableId}
                      setSelectedTableId={setSelectedTableId}
                      isCountdown={isCountdown ?? false}
                      publishTablesAt={selectedEventObj?.publishTablesAt}
                      setIsWaitlistMode={setIsWaitlistMode}
                      isLoadingTables={isLoadingBookedTables}
                    />
                  )}

                  {currentStep === (selectedEventObj?.allowTableSelection !== false ? 3 : 2) && (
                    <Step3_TimePackage
                      times={times}
                      packages={packages}
                      selectedTime={selectedTime}
                      selectedPackage={selectedPackage}
                      guests={guests}
                      selectedTableObj={selectedTableObj}
                      setSelectedTime={setSelectedTime}
                      setSelectedPackage={setSelectedPackage}
                      setGuests={setGuests}
                      requireFullTable={eventSettings?.requireFullTable ?? true}
                    />
                  )}

                  {currentStep === totalSteps && (
                    <Step4_Checkout
                      key={captchaVersion}
                      guestName={guestName}
                      guestEmail={guestEmail}
                      setGuestName={setGuestName}
                      setGuestEmail={setGuestEmail}
                      turnstileToken={turnstileToken}
                      setTurnstileToken={setTurnstileToken}
                      checkoutError={checkoutError}
                      onValidChange={setIsStep4Valid}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation Buttons (Desktop) */}
              <div className="hidden lg:flex justify-between mt-12 pt-8 border-t border-border-light">
                {currentStep > 1 ? (
                  <button onClick={handleBack} className="px-8 py-4 border border-border-light hover:bg-canvas-light transition-colors rounded-xl font-bold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Zurück
                  </button>
                ) : <div/>}

                {currentStep < totalSteps ? (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="ml-auto px-10 py-4 bg-accent-green text-white hover:bg-base-dark transition-colors rounded-xl font-black uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
                  >
                    Weiter
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={!canProceed() || isCheckingOut}
                    className="ml-auto px-10 py-4 bg-accent-green text-white hover:bg-base-dark transition-colors rounded-xl font-black uppercase tracking-widest disabled:opacity-30"
                  >
                    {isCheckingOut ? t('submitting') : t('submit_btn')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Summary (Desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24">
              <SummaryPanel
                selectedEventObj={selectedEventObj}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                selectedTableObj={selectedTableObj}
                guests={guests}
                selectedPackage={selectedPackage}
                packages={packages}
                amountTotal={amountTotal}
                minimumConsumption={minimumConsumption}
                customServiceFee={eventSettings?.customServiceFee}
                serviceFeePercent={eventSettings?.serviceFeePercent}
                serviceFeeFixedCents={eventSettings?.serviceFeeFixedCents}
              />
            </div>
          </div>

        </div>

        {/* Mobile Sticky Bottom Bar */}
        <div className="fixed z-50 bottom-0 left-0 right-0 bg-white border-t border-border-light p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:hidden">
          <div className="flex gap-3 max-w-[1400px] mx-auto">
            {currentStep > 1 && (
              <button onClick={handleBack} className="w-14 shrink-0 flex items-center justify-center border border-border-light active:bg-canvas-light transition-colors rounded-xl font-bold">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl disabled:opacity-30 flex justify-center items-center gap-2 active:scale-95 transition-all"
              >
                Weiter
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleCheckout}
                disabled={!canProceed() || isCheckingOut}
                className="flex-1 bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-all"
              >
                {isCheckingOut ? t('submitting') : t('submit_btn')}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Waitlist Modal (unchanged except styling upgrades if needed) */}
      {isWaitlistMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-base-dark/80 backdrop-blur-sm animate-fade-in">
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
                  <input required type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full border border-border-light rounded-xl px-4 py-3 bg-white focus:border-accent-green focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">{t('email_label')}</label>
                  <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full border border-border-light rounded-xl px-4 py-3 bg-white focus:border-accent-green focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">{t('persons')}</label>
                  <input required type="number" min={1} value={guests} onChange={e => setGuests(parseInt(e.target.value) || 1)} className="w-full border border-border-light rounded-xl px-4 py-3 bg-white focus:border-accent-green focus:outline-none" />
                </div>

                <div className="flex justify-center">
                  <Turnstile
                    key={waitlistCaptchaVersion}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onSuccess={(token) => setWaitlistTurnstileToken(token)}
                    onExpire={() => setWaitlistTurnstileToken('')}
                    onError={() => setWaitlistTurnstileToken('')}
                    options={{ theme: "light", action: 'waitlist' }}
                  />
                </div>

                <button disabled={isCheckingOut || !waitlistTurnstileToken} type="submit" className="w-full bg-accent-green text-white font-bold py-4 rounded-xl disabled:opacity-50">
                  {isCheckingOut ? t('submitting') : t('waitlist_submit')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </section>
  );
}
