"use client";

import { useTranslations } from "next-intl";
import { Turnstile } from "@marsidev/react-turnstile";
import { useState, useEffect } from "react";

export default function Step4_Checkout({
  guestName,
  guestEmail,
  setGuestName,
  setGuestEmail,
  turnstileToken,
  setTurnstileToken,
  checkoutError,
  onValidChange,
}: {
  guestName: string;
  guestEmail: string;
  setGuestName: (name: string) => void;
  setGuestEmail: (email: string) => void;
  turnstileToken: string;
  setTurnstileToken: (token: string) => void;
  checkoutError: string;
  onValidChange: (isValid: boolean) => void;
}) {
  const t = useTranslations("Reservation");
  const [touched, setTouched] = useState({ name: false, email: false });

  const isNameValid = guestName.trim().length >= 2 && guestName.trim().length <= 100;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());

  useEffect(() => {
    onValidChange(isNameValid && isEmailValid);
  }, [isNameValid, isEmailValid, onValidChange]);

  const nameError = touched.name && !isNameValid ? "Bitte mindestens 2 Zeichen eingeben" : "";
  const emailError = touched.email && !isEmailValid ? "Bitte eine gültige E-Mail-Adresse eingeben" : "";

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold mb-6 text-base-dark">Deine Daten & Bezahlung</h3>
      
      {checkoutError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm font-bold flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{checkoutError}</span>
        </div>
      )}

      <div className="space-y-6 max-w-xl">
        <div>
          <label htmlFor="guestName" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('name_label')}</label>
          <input 
            id="guestName"
            type="text" 
            required
            minLength={2}
            maxLength={100}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
            placeholder="Max Mustermann"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "name-error" : undefined}
            className={`w-full bg-white border rounded-xl px-5 py-4 text-base text-base-dark focus:ring-1 focus:outline-none transition-all shadow-sm ${
              nameError ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-border-light focus:border-accent-green focus:ring-accent-green"
            }`}
          />
          {nameError && (
            <p id="name-error" role="alert" aria-live="polite" className="text-red-500 text-sm mt-2 font-bold">{nameError}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="guestEmail" className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">{t('email_label')}</label>
          <input 
            id="guestEmail"
            type="email" 
            required
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
            placeholder="max@beispiel.de"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            className={`w-full bg-white border rounded-xl px-5 py-4 text-base text-base-dark focus:ring-1 focus:outline-none transition-all shadow-sm ${
              emailError ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-border-light focus:border-accent-green focus:ring-accent-green"
            }`}
          />
          {emailError && (
            <p id="email-error" role="alert" aria-live="polite" className="text-red-500 text-sm mt-2 font-bold">{emailError}</p>
          )}
        </div>

        <div className="pt-4 flex flex-col items-start gap-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-accent-green">Spamschutz</label>
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onSuccess={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                    options={{ theme: 'light', action: 'checkout' }}
          />
        </div>
        
        <div className="text-sm text-base-dark/60 leading-relaxed pt-4 border-t border-border-light">
          Mit dem Klick auf den Button akzeptierst du unsere <a href="/agb" className="underline hover:text-accent-green font-bold" target="_blank">AGB</a> und <a href="/widerruf" className="underline hover:text-accent-green font-bold" target="_blank">Stornobedingungen</a>.
        </div>
      </div>
    </div>
  );
}
