"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Link } from "@/i18n/routing";
import type { EventRecord } from "@/types/domain";
import { reservationMailto } from "@/lib/reservation-mode";
import { ui, DATE_TAG } from "@/lib/localize";
import { submitReservationRequest } from "@/app/actions/reservationRequests";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  club: "",
  date: "",
  time: "",
  guests: 10,
  tables: 1,
  message: "",
  privacy: false,
};

export default function EmailReservationCard({ event, locale }: { event: EventRecord; locale: string }) {
  const dates = event.reservableDates?.length
    ? event.reservableDates
    : [new Date(event.date).toISOString().slice(0, 10)];
  const mailtoHref = reservationMailto(event, locale);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: dates[0] || "" });
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open]);

  const copy = {
    eyebrow: ui(locale, { de: "Reservierung", en: "Reservation", bar: "Reservierung" }),
    title: ui(locale, { de: "Reservierung per E-Mail", en: "Reserve by email", bar: "Reservierung per E-Mail" }),
    text: event.reservationNote || ui(locale, {
      de: "Schreib uns kurz mit Verein, Personenzahl und gewünschter Tischanzahl. Wir melden uns mit den Details bei dir.",
      en: "Send us a short message with your club, the number of people and the desired tables. We will get back to you with the details.",
      bar: "Schreib uns kurz mit Verein, Personenzahl und gwünschta Tischanzahl. Mia meldn uns mit de Details bei dir.",
    }),
    button: ui(locale, { de: "Tisch anfragen", en: "Request a table", bar: "Tisch anfrogn" }),
    hint: ui(locale, { de: "Keine Online-Zahlung, keine Buchungsgebühr.", en: "No online payment, no booking fee.", bar: "Koa Online-Zahlung, koa Buchungsgebühr." }),
    fallback: ui(locale, { de: "Oder direkt schreiben:", en: "Or write us directly:", bar: "Oder direkt schreibn:" }),
    sent_title: ui(locale, { de: "Anfrage eingegangen", en: "Request received", bar: "Ofrog okemma" }),
    close: ui(locale, { de: "Schließen", en: "Close", bar: "Zuamacha" }),
    success_title: ui(locale, { de: "Servus! Deine Anfrage ist bei uns eingegangen.", en: "Hi! Your request has reached us.", bar: "Servus! Dei Ofrog is bei uns okemma." }),
    success_text: ui(locale, { de: "Wir prüfen die Verfügbarkeit und melden uns in der Regel innerhalb von 2 Werktagen per E-Mail.", en: "We check availability and usually get back to you by email within 2 working days.", bar: "Mia prüfn de Verfügbarkeit und mejdn uns in da Regel innerhalb vo 2 Werkdog per E-Mail." }),
    another: ui(locale, { de: "Weitere Anfrage", en: "Another request", bar: "Weitare Ofrog" }),
    label_name: ui(locale, { de: "Name *", en: "Name *", bar: "Nam *" }),
    label_club: ui(locale, { de: "Verein / Firma", en: "Club / company", bar: "Verein / Firma" }),
    label_email: ui(locale, { de: "E-Mail *", en: "Email *", bar: "E-Mail *" }),
    label_phone: ui(locale, { de: "Telefon", en: "Phone", bar: "Telefon" }),
    label_date: ui(locale, { de: "Datum *", en: "Date *", bar: "Datum *" }),
    label_time: ui(locale, { de: "Uhrzeitwunsch", en: "Preferred time", bar: "Uhrzeitwunsch" }),
    label_guests: ui(locale, { de: "Personen *", en: "People *", bar: "Persona *" }),
    label_tables: ui(locale, { de: "Gewünschte Tische *", en: "Desired tables *", bar: "Gwünschte Tische *" }),
    label_message: ui(locale, { de: "Nachricht", en: "Message", bar: "Nochricht" }),
    placeholder_message: ui(locale, { de: "Besondere Wünsche, Anlass, Fragen…", en: "Special requests, occasion, questions…", bar: "Bsondere Wünsche, Onlass, Frogn…" }),
    privacy_prefix: ui(locale, { de: "Ich habe die ", en: "I have read the ", bar: "I hob de " }),
    privacy_link: ui(locale, { de: "Datenschutzerklärung", en: "privacy policy", bar: "Datenschutzerklärung" }),
    privacy_suffix: ui(locale, { de: " gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Anfrage zu. *", en: " and agree to the processing of my data to handle the request. *", bar: " gleesn und stimm da Verarbeitung vo meine Daten zua Bearbeitung da Ofrog zua. *" }),
    required_hint: ui(locale, { de: "* Pflichtfeld. Keine Online-Zahlung.", en: "* Required field. No online payment.", bar: "* Pflichtfejd. Koa Online-Zahlung." }),
    submitting: ui(locale, { de: "Wird gesendet…", en: "Sending…", bar: "Wird gschickt…" }),
    submit: ui(locale, { de: "Anfrage senden", en: "Send request", bar: "Ofrog oschicka" }),
    err_robot: ui(locale, { de: "Bitte bestätige, dass du kein Roboter bist.", en: "Please confirm that you are not a robot.", bar: "Bitt bestätige, dass du koa Roboter bist." }),
    err_privacy: ui(locale, { de: "Bitte bestätige die Datenschutzerklärung.", en: "Please accept the privacy policy.", bar: "Bitt bestätige de Datenschutzerklärung." }),
    err_send: ui(locale, { de: "Anfrage konnte nicht gesendet werden.", en: "The request could not be sent.", bar: "Ofrog hod ned gschickt werdn kinna." }),
    err_send_retry: ui(locale, { de: "Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.", en: "The request could not be sent. Please try again later.", bar: "Ofrog hod ned gschickt werdn kinna. Bitt probier's spada nochmal." }),
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
    setWarning("");
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!turnstileToken) { setError(copy.err_robot); return; }
    if (!form.privacy) { setError(copy.err_privacy); return; }
    setSubmitting(true);
    setError("");
    setWarning("");
    try {
      const payload = JSON.stringify(form);
      if (!attempt.current || attempt.current.payload !== payload) {
        attempt.current = { payload, key: crypto.randomUUID() };
      }
      const result = await submitReservationRequest({
        eventId: event.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        club: form.club,
        reservationDate: form.date,
        time: form.time,
        guestCount: form.guests,
        tables: form.tables,
        message: form.message,
        privacy: form.privacy,
        turnstileToken,
        idempotencyKey: attempt.current.key,
      });
      if (!result.success) {
        setError(result.error || copy.err_send);
        setTurnstileToken("");
        setCaptchaVersion(version => version + 1);
        return;
      }
      setSent(true);
      setWarning(result.warning || "");
      setForm({ ...EMPTY_FORM, date: dates[0] || "" });
      attempt.current = null;
      setTurnstileToken("");
      setCaptchaVersion(version => version + 1);
    } catch {
      setError(copy.err_send_retry);
      setTurnstileToken("");
      setCaptchaVersion(version => version + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-24 md:mt-32">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="relative overflow-hidden bg-canvas-light border border-border-light rounded-3xl p-8 md:p-12">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent-green/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-3">{copy.eyebrow}</p>
            <h2 className="font-display font-bold text-3xl md:text-5xl text-base-dark mb-4">{copy.title.split(" ").slice(0, -1).join(" ")}{" "}<span className="text-accent-green italic">{copy.title.split(" ").slice(-1)}</span></h2>
            <p className="font-sans text-base md:text-lg text-base-dark/70 leading-relaxed mb-8">{copy.text}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={() => { setSent(false); setError(""); setWarning(""); setOpen(true); }}
                className="inline-flex items-center justify-center gap-3 bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-accent-green/80 transition-colors shadow-sm"
              >
                {copy.button}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <span className="text-sm font-sans text-base-dark/60">{copy.hint}</span>
            </div>
            <p className="mt-6 text-sm font-sans text-base-dark/60">
              {copy.fallback}{" "}
              <a href={mailtoHref} className="font-bold text-accent-green underline underline-offset-4">
                {event.reservationEmail || "servus@maurer-events.com"}
              </a>
            </p>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-base-dark/80 backdrop-blur-sm p-3 md:p-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-request-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-border-light my-4 md:my-0"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-6 md:p-8 border-b border-border-light">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">{copy.eyebrow}</p>
                <h2 id="reservation-request-title" className="font-display font-bold text-2xl md:text-3xl text-base-dark">
                  {sent ? copy.sent_title : copy.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="w-11 h-11 shrink-0 rounded-full bg-canvas-light flex items-center justify-center text-base-dark hover:bg-border-light transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sent ? (
              <div className="p-6 md:p-8 space-y-4">
                <div className="bg-accent-green/10 border border-accent-green/30 rounded-2xl p-5 text-base-dark">
                  <p className="font-bold mb-2">{copy.success_title}</p>
                  <p className="text-sm leading-relaxed">
                    {copy.success_text}
                  </p>
                </div>
                {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{warning}</p>}
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setOpen(false)} className="bg-accent-green text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-accent-green/80 transition-colors">
                    {copy.close}
                  </button>
                  <button type="button" onClick={() => { setSent(false); setForm({ ...EMPTY_FORM, date: dates[0] || "" }); }} className="bg-canvas-light text-base-dark px-6 py-3 rounded-full font-bold text-sm hover:bg-border-light transition-colors">
                    {copy.another}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="request-name" className="block text-sm font-bold mb-1">{copy.label_name}</label>
                    <input id="request-name" required minLength={2} maxLength={100} value={form.name} onChange={e => update("name", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-club" className="block text-sm font-bold mb-1">{copy.label_club}</label>
                    <input id="request-club" maxLength={150} value={form.club} onChange={e => update("club", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-email" className="block text-sm font-bold mb-1">{copy.label_email}</label>
                    <input id="request-email" type="email" required maxLength={254} value={form.email} onChange={e => update("email", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-phone" className="block text-sm font-bold mb-1">{copy.label_phone}</label>
                    <input id="request-phone" type="tel" maxLength={50} value={form.phone} onChange={e => update("phone", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-date" className="block text-sm font-bold mb-1">{copy.label_date}</label>
                    <select id="request-date" required value={form.date} onChange={e => update("date", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green">
                      {dates.map(date => (
                        <option key={date} value={date}>{new Date(`${date}T12:00:00Z`).toLocaleDateString(DATE_TAG[locale] ?? "de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="request-time" className="block text-sm font-bold mb-1">{copy.label_time}</label>
                    <input id="request-time" type="time" value={form.time} onChange={e => update("time", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-guests" className="block text-sm font-bold mb-1">{copy.label_guests}</label>
                    <input id="request-guests" type="number" min={1} max={100} required value={form.guests} onChange={e => update("guests", Number(e.target.value))} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-tables" className="block text-sm font-bold mb-1">{copy.label_tables}</label>
                    <input id="request-tables" type="number" min={1} max={50} required value={form.tables} onChange={e => update("tables", Number(e.target.value))} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                </div>
                <div>
                  <label htmlFor="request-message" className="block text-sm font-bold mb-1">{copy.label_message}</label>
                  <textarea id="request-message" maxLength={2000} value={form.message} onChange={e => update("message", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green min-h-[100px]" placeholder={copy.placeholder_message} />
                </div>
                <label className="flex items-start gap-3 text-sm text-base-dark/80">
                  <input type="checkbox" required checked={form.privacy} onChange={e => update("privacy", e.target.checked)} className="mt-1 w-5 h-5 accent-accent-green" />
                  <span>
                    {copy.privacy_prefix}<Link href="/datenschutz" target="_blank" className="text-accent-green underline underline-offset-4 font-bold">{copy.privacy_link}</Link>{copy.privacy_suffix}
                  </span>
                </label>
                <div className="pt-1">
                  <Turnstile
                    key={captchaVersion}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onSuccess={token => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken("")}
                    onError={() => setTurnstileToken("")}
                    options={{ theme: "light", action: "reservation-request" }}
                  />
                </div>
                {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
                {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{warning}</p>}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <button type="submit" disabled={submitting || !turnstileToken} className="bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-accent-green/80 transition-colors disabled:opacity-50">
                    {submitting ? copy.submitting : copy.submit}
                  </button>
                  <span className="text-xs text-base-dark/50">{copy.required_hint}</span>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}