"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Link } from "@/i18n/routing";
import type { EventRecord } from "@/types/domain";
import { reservationMailto } from "@/lib/reservation-mode";
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

  const copy = locale === "en"
    ? {
        eyebrow: "Reservation",
        title: "Reserve by email",
        text: event.reservationNote || "Send us a short message with your club, the number of people and the desired tables. We will get back to you with the details.",
        button: "Request a table",
        hint: "No online payment, no booking fee.",
        fallback: "Or write us directly:",
      }
    : {
        eyebrow: "Reservierung",
        title: "Reservierung per E-Mail",
        text: event.reservationNote || "Schreib uns kurz mit Verein, Personenzahl und gewünschter Tischanzahl. Wir melden uns mit den Details bei dir.",
        button: "Tisch anfragen",
        hint: "Keine Online-Zahlung, keine Buchungsgebühr.",
        fallback: "Oder direkt schreiben:",
      };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
    setWarning("");
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!turnstileToken) { setError("Bitte bestätige, dass du kein Roboter bist."); return; }
    if (!form.privacy) { setError("Bitte bestätige die Datenschutzerklärung."); return; }
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
        setError(result.error || "Anfrage konnte nicht gesendet werden.");
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
      setError("Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.");
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
            <h2 className="font-display font-bold text-3xl md:text-5xl text-base-dark mb-4">{copy.title}</h2>
            <p className="font-sans text-base md:text-lg text-base-dark/70 leading-relaxed mb-8">{copy.text}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={() => { setSent(false); setError(""); setWarning(""); setOpen(true); }}
                className="inline-flex items-center justify-center gap-3 bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-base-dark transition-colors shadow-sm"
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
                  {sent ? "Anfrage eingegangen" : copy.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
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
                  <p className="font-bold mb-2">Servus! Deine Anfrage ist bei uns eingegangen.</p>
                  <p className="text-sm leading-relaxed">
                    Wir prüfen die Verfügbarkeit und melden uns in der Regel innerhalb von 2 Werktagen per E-Mail.
                  </p>
                </div>
                {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{warning}</p>}
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setOpen(false)} className="bg-accent-green text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-base-dark transition-colors">
                    Schließen
                  </button>
                  <button type="button" onClick={() => { setSent(false); setForm({ ...EMPTY_FORM, date: dates[0] || "" }); }} className="bg-canvas-light text-base-dark px-6 py-3 rounded-full font-bold text-sm hover:bg-border-light transition-colors">
                    Weitere Anfrage
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="request-name" className="block text-sm font-bold mb-1">Name *</label>
                    <input id="request-name" required minLength={2} maxLength={100} value={form.name} onChange={e => update("name", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-club" className="block text-sm font-bold mb-1">Verein / Firma</label>
                    <input id="request-club" maxLength={150} value={form.club} onChange={e => update("club", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-email" className="block text-sm font-bold mb-1">E-Mail *</label>
                    <input id="request-email" type="email" required maxLength={254} value={form.email} onChange={e => update("email", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-phone" className="block text-sm font-bold mb-1">Telefon</label>
                    <input id="request-phone" type="tel" maxLength={50} value={form.phone} onChange={e => update("phone", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-date" className="block text-sm font-bold mb-1">Datum *</label>
                    <select id="request-date" required value={form.date} onChange={e => update("date", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green">
                      {dates.map(date => (
                        <option key={date} value={date}>{new Date(`${date}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="request-time" className="block text-sm font-bold mb-1">Uhrzeitwunsch</label>
                    <input id="request-time" type="time" value={form.time} onChange={e => update("time", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-guests" className="block text-sm font-bold mb-1">Personen *</label>
                    <input id="request-guests" type="number" min={1} max={100} required value={form.guests} onChange={e => update("guests", Number(e.target.value))} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label htmlFor="request-tables" className="block text-sm font-bold mb-1">Gewünschte Tische *</label>
                    <input id="request-tables" type="number" min={1} max={50} required value={form.tables} onChange={e => update("tables", Number(e.target.value))} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                  </div>
                </div>
                <div>
                  <label htmlFor="request-message" className="block text-sm font-bold mb-1">Nachricht</label>
                  <textarea id="request-message" maxLength={2000} value={form.message} onChange={e => update("message", e.target.value)} className="w-full border border-border-light rounded-xl p-3 bg-base-light focus:outline-none focus:border-accent-green min-h-[100px]" placeholder="Besondere Wünsche, Anlass, Fragen…" />
                </div>
                <label className="flex items-start gap-3 text-sm text-base-dark/80">
                  <input type="checkbox" required checked={form.privacy} onChange={e => update("privacy", e.target.checked)} className="mt-1 w-5 h-5 accent-accent-green" />
                  <span>
                    Ich habe die <Link href="/datenschutz" target="_blank" className="text-accent-green underline underline-offset-4 font-bold">Datenschutzerklärung</Link> gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Anfrage zu. *
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
                  <button type="submit" disabled={submitting || !turnstileToken} className="bg-accent-green text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-base-dark transition-colors disabled:opacity-50">
                    {submitting ? "Wird gesendet…" : "Anfrage senden"}
                  </button>
                  <span className="text-xs text-base-dark/50">* Pflichtfeld. Keine Online-Zahlung.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}