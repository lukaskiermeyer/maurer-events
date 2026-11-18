"use client";
import Image from 'next/image';

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Turnstile } from '@marsidev/react-turnstile';
import { submitContactForm } from "@/app/actions/contact";

const EVENT_TYPES = [
  { value: 'volksfest', key: 'option_volksfest' },
  { value: 'firma', key: 'option_firma' },
  { value: 'verein', key: 'option_verein' },
  { value: 'privat', key: 'option_privat' },
  { value: 'sonstiges', key: 'option_other' },
] as const;

const STEPS = [
  { labelKey: 'steps_anlass', titleKey: 'step1_title', hintKey: 'step1_hint' },
  { labelKey: 'steps_kontakt', titleKey: 'step2_title', hintKey: 'step2_hint' },
  { labelKey: 'steps_nachricht', titleKey: 'step3_title', hintKey: 'step3_hint' },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactSection() {
  const t = useTranslations("Contact");
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);

  // Wizard-State (kontrollierte Felder, damit Werte beim Wechseln der Steps erhalten bleiben)
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState("");
  const [eventType, setEventType] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const isStepValid = (forStep: number) => {
    if (forStep === 0) return eventType !== "";
    if (forStep === 1) return name.trim() !== "" && EMAIL_PATTERN.test(email.trim());
    return message.trim() !== "";
  };

  const goToStep = (nextStep: number) => {
    setDirection(nextStep > step ? 1 : -1);
    setStepError("");
    setStep(nextStep);
  };

  const handleNext = () => {
    if (!isStepValid(step)) {
      setStepError(
        step === 0 ? t("err_event_type") : t("err_contact")
      );
      return;
    }
    goToStep(Math.min(step + 1, STEPS.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Enter-Taste in Step 1/2 = "Weiter"
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    if (!isStepValid(2)) {
      setStepError(t("err_message"));
      return;
    }
    if (!turnstileToken) {
      setErrorMessage(t("err_robot"));
      return;
    }

    setFormStatus("submitting");
    setErrorMessage("");
    setStepError("");

    const result = await submitContactForm({
      name: name.trim(),
      email: email.trim(),
      eventType,
      message: message.trim(),
      turnstileToken
    });
    setTurnstileToken('');
    setCaptchaVersion(value => value + 1);

    if (result.success) {
      setFormStatus("success");
      setEventType("");
      setName("");
      setEmail("");
      setMessage("");
      setStep(0);
    } else {
      setFormStatus("error");
      setErrorMessage(result.error || "Ein unbekannter Fehler ist aufgetreten.");
    }
  };

  const selectedEventLabel = EVENT_TYPES.find(option => option.value === eventType)?.key;

  return (
    <section id="contact" className="py-24 md:py-32 bg-base-light relative overflow-hidden">
      {/* Festzelt Stripe Detail am oberen Rand */}
      <div className="absolute top-0 left-0 w-full h-2" style={{
        background: 'repeating-linear-gradient(45deg, var(--color-accent-green), var(--color-accent-green) 20px, var(--color-base-light) 20px, var(--color-base-light) 40px)'
      }}></div>
      <div className="absolute top-2 left-0 w-full border-t border-base-dark"></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16">

        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display font-bold text-5xl md:text-7xl mb-4 text-base-dark"
          >
            {t("heading_prefix")} <span className="text-accent-green">{t("heading_accent")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-sans text-lg text-base-dark/60 font-medium max-w-2xl mx-auto"
          >
            {t("heading_subtitle")}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">

          {/* Contact Info Side */}
          <div className="lg:col-span-5 bg-accent-green text-base-light rounded-3xl p-10 md:p-14 flex flex-col justify-between shadow-xl relative overflow-hidden">
            {/* Soft background shape */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

            <div className="relative z-10">
              <h3 className="font-subhead text-3xl md:text-4xl mb-6">{t("info_title")}</h3>
              <p className="font-sans text-base-light/80 text-lg mb-12">
                {t("info_text")}
              </p>

              <div className="space-y-8 font-sans">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-base-light/70 mb-1">{t("location")}</h4>
                    <p className="text-lg">Schwaiger Str. 6<br/>85126 Müchsmünster</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-base-light/70 mb-1">{t("email")}</h4>
                    <p className="text-lg">servus@maurer-events.com</p>
                  </div>
                </div>

                {/* Removed phone since it wasn't provided for contact form officially */}
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 md:p-14 shadow-xl border border-border-light relative">

            {formStatus === "success" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-20"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
                  className="w-20 h-20 bg-accent-green/10 text-accent-green rounded-full flex items-center justify-center mb-6"
                >
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h4 className="font-subhead text-4xl text-base-dark mb-4">{t("form_success_title")}</h4>
                <p className="text-base-dark/70 font-sans text-lg mb-12">{t("form_success_desc")}</p>
                <button
                  type="button"
                  onClick={() => { setFormStatus("idle"); setStep(0); }}
                  className="font-display font-bold text-sm text-accent-green hover:text-base-dark transition-colors border-b border-accent-green pb-1"
                >
                  {t("form_success_btn")}
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>

                {/* Fortschritt: 3 Steps mit animiertem Balken */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-6" aria-hidden="true">
                    <span className="text-xs font-bold uppercase tracking-widest text-accent-green">
                      {t("step_of", { step: step + 1, total: STEPS.length })}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest text-base-dark/60">
                      {Math.round(((step + 1) / STEPS.length) * 100)}%
                    </span>
                  </div>
                  <div className="relative flex items-start justify-between list-none p-0 m-0">
                    <span className="absolute left-0 right-0 top-5 h-1.5 -translate-y-1/2 rounded-full bg-border-light" />
                    <motion.span
                      className="absolute left-0 top-5 h-1.5 -translate-y-1/2 rounded-full bg-accent-green"
                      initial={false}
                      animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                    {STEPS.map((stepItem, index) => {
                      const isDone = index < step;
                      const isCurrent = index === step;
                      return (
                        <div key={stepItem.labelKey} className="relative z-10 flex flex-col items-center gap-2 w-16" aria-current={isCurrent ? "step" : undefined}>
                          <motion.span
                            initial={false}
                            animate={{ scale: isCurrent ? 1.15 : 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 16 }}
                            className={`flex w-11 h-11 items-center justify-center rounded-full font-display font-black text-sm shadow-sm transition-colors ${
                              isDone || isCurrent
                                ? "bg-accent-green text-white"
                                : "bg-border-light text-base-dark/60"
                            }`}
                          >
                            {isDone ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              index + 1
                            )}
                          </motion.span>
                          <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? "text-base-dark" : "text-base-dark/60"}`}>
                            {t(stepItem.labelKey)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {formStatus === "error" && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-bold mb-6">
                    {errorMessage}
                  </div>
                )}

                {/* Step-Panel */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: direction * 48 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -48 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                  >
                    <h3 className="font-subhead text-2xl md:text-3xl text-base-dark mb-2">
                      {t(STEPS[step].titleKey)}
                    </h3>
                    <p className="font-sans text-base-dark/60 mb-8">{t(STEPS[step].hintKey)}</p>

                    {stepError && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
                        role="alert"
                      >
                        {stepError}
                      </motion.p>
                    )}

                    {step === 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t("label_type")}>
                        {EVENT_TYPES.map((option) => {
                          const isSelected = eventType === option.value;
                          return (
                            <motion.button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => { setEventType(option.value); setStepError(""); }}
                              whileTap={{ scale: 0.97 }}
                              className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-left font-bold transition-colors ${
                                isSelected
                                  ? "border-accent-green bg-accent-green/10 text-base-dark"
                                  : "border-border-light bg-border-light/40 text-base-dark/70 hover:border-accent-green/50"
                              }`}
                            >
                              <span>{t(option.key)}</span>
                              <AnimatePresence>
                                {isSelected && (
                                  <motion.span
                                    initial={{ scale: 0, rotate: -40 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    exit={{ scale: 0 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 16 }}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-green text-white"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {step === 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col">
                          <label htmlFor="name" className="text-sm font-bold text-base-dark mb-2">{t("label_name")}</label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setStepError(""); }}
                            className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all"
                            placeholder={t("placeholder_name")}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label htmlFor="email" className="text-sm font-bold text-base-dark mb-2">{t("label_email")}</label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setStepError(""); }}
                            className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all"
                            placeholder={t("placeholder_email")}
                          />
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        {selectedEventLabel && (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-bold text-base-dark/50">{t("your_occasion")}</span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-accent-green/10 px-3 py-1 font-bold text-accent-green">
                              {t(selectedEventLabel)}
                              <button
                                type="button"
                                onClick={() => goToStep(0)}
                                className="underline underline-offset-2 hover:text-base-dark transition-colors"
                                aria-label={t("change")}
                              >
                                {t("change")}
                              </button>
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <label htmlFor="message" className="text-sm font-bold text-base-dark mb-2">{t("label_message")}</label>
                          <textarea
                            id="message"
                            name="message"
                            rows={5}
                            value={message}
                            onChange={(e) => { setMessage(e.target.value); setStepError(""); }}
                            className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all resize-none"
                            placeholder={t("placeholder_message")}
                          ></textarea>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Turnstile bleibt gemountet (Token geht beim Step-Wechsel nicht verloren),
                    wird aber nur in Step 3 gezeigt */}
                <div className={step === 2 ? "py-6" : "hidden"}>
                  <Turnstile
                    key={captchaVersion}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onSuccess={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                    options={{ theme: 'light', action: 'contact' }}
                  />
                </div>

                {/* Navigation */}
                <div className="relative pt-6 flex justify-between items-center gap-4">
                  <div>
                    {step > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => goToStep(step - 1)}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-2 rounded-xl border border-border-light bg-white px-6 py-4 font-display font-bold text-base-dark transition-all hover:border-accent-green"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        {t("back")}
                      </motion.button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Easteregg Figure hiding behind button */}
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8, type: "spring" }}
                      className="w-24 md:w-32 pointer-events-none hidden sm:block"
                    >
                      <Image src="/figur-transparent.png" alt="Festwirt Easteregg" width={1007} height={853} sizes="128px" className="w-full h-auto drop-shadow-md opacity-80" />
                    </motion.div>

                    {step < STEPS.length - 1 ? (
                      <motion.button
                        type="button"
                        onClick={handleNext}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="bg-accent-green text-white px-8 py-4 rounded-xl font-display font-bold text-lg hover:bg-base-dark transition-colors flex items-center gap-3 shadow-lg hover:shadow-xl"
                      >
                        {t("next")}
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </motion.button>
                    ) : (
                      <motion.button
                        type="submit"
                        disabled={formStatus === "submitting" || !turnstileToken}
                        whileHover={formStatus === "submitting" || !turnstileToken ? undefined : { scale: 1.03 }}
                        whileTap={formStatus === "submitting" || !turnstileToken ? undefined : { scale: 0.97 }}
                        className="bg-accent-green text-white px-8 py-4 rounded-xl font-display font-bold text-lg hover:bg-base-dark transition-colors disabled:opacity-50 flex items-center gap-3 shadow-lg hover:shadow-xl"
                      >
                        {formStatus === "submitting" ? t("btn_submitting") : t("btn_submit")}
                        {formStatus !== "submitting" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
