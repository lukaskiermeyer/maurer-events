"use client";

import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Turnstile } from '@marsidev/react-turnstile';
import { submitContactForm } from "@/app/actions/contact";

export default function ContactSection() {
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!turnstileToken) {
      setErrorMessage("Bitte bestätige, dass du kein Roboter bist.");
      return;
    }

    setFormStatus("submitting");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const result = await submitContactForm({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      eventType: formData.get("eventType") as string,
      message: formData.get("message") as string,
      turnstileToken
    });

    if (result.success) {
      setFormStatus("success");
      formRef.current?.reset();
    } else {
      setFormStatus("error");
      setErrorMessage(result.error || "Ein unbekannter Fehler ist aufgetreten.");
    }
  };

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
            Sende uns eine <span className="text-accent-green">Anfrage</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-sans text-lg text-base-dark/60 font-medium max-w-2xl mx-auto"
          >
            Lass uns gemeinsam Großes planen.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">
          
          {/* Contact Info Side */}
          <div className="lg:col-span-5 bg-accent-green text-base-light rounded-3xl p-10 md:p-14 flex flex-col justify-between shadow-xl relative overflow-hidden">
            {/* Soft background shape */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

            <div className="relative z-10">
              <h3 className="font-display font-bold text-3xl md:text-4xl mb-6">Wir freuen uns auf dich</h3>
              <p className="font-sans text-base-light/80 text-lg mb-12">
                Egal ob zünftiges Bierzelt oder elegantes Firmenevent.
              </p>

              <div className="space-y-8 font-sans">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-base-light/70 mb-1">Standort</h5>
                    <p className="text-lg">Schwaiger Str. 6<br/>85126 Müchsmünster</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-base-light/70 mb-1">E-Mail</h5>
                    <p className="text-lg">servus@maurer-events.com</p>
                  </div>
                </div>

                {/* Removed phone since it wasn't provided for contact form officially */}
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-border-light relative">
            
            {formStatus === "success" ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-20"
              >
                <div className="w-20 h-20 bg-accent-green/10 text-accent-green rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-display font-bold text-4xl text-base-dark mb-4">Vielen Dank!</h4>
                <p className="text-base-dark/70 font-sans text-lg mb-12">Wir haben deine Anfrage erhalten und melden uns so schnell wie möglich bei dir.</p>
                <button 
                  onClick={() => setFormStatus("idle")}
                  className="font-display font-bold text-sm text-accent-green hover:text-base-dark transition-colors border-b border-accent-green pb-1"
                >
                  Weitere Anfrage senden
                </button>
              </motion.div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
                {formStatus === "error" && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-bold mb-6">
                    {errorMessage}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col">
                    <label htmlFor="name" className="text-sm font-bold text-base-dark mb-2">Name / Firma</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name"
                      required
                      className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all"
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="email" className="text-sm font-bold text-base-dark mb-2">E-Mail Adresse</label>
                    <input 
                      type="email" 
                      id="email" 
                      name="email"
                      required
                      className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all"
                      placeholder="max@beispiel.de"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="eventType" className="text-sm font-bold text-base-dark mb-2">Art der Veranstaltung</label>
                  <select 
                    id="eventType" 
                    name="eventType"
                    required
                    defaultValue=""
                    className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all appearance-none"
                  >
                    <option value="" disabled hidden>Bitte wählen...</option>
                    <option value="volksfest">Volksfest / Bierzelt</option>
                    <option value="firma">Firmenevent / Jubiläum</option>
                    <option value="verein">Vereinsfest</option>
                    <option value="privat">Private Feier / Hochzeit</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="message" className="text-sm font-bold text-base-dark mb-2">Deine Nachricht</label>
                  <textarea 
                    id="message" 
                    name="message"
                    rows={4} 
                    required
                    className="w-full bg-border-light/40 border border-border-light rounded-xl px-4 py-3 text-base text-base-dark focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green transition-all resize-none"
                    placeholder="Worum geht es?"
                  ></textarea>
                </div>

                <div className="py-2">
                  <Turnstile 
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"} 
                    onSuccess={(token) => setTurnstileToken(token)}
                    options={{ theme: 'light' }}
                  />
                </div>

                <div className="relative pt-4 flex justify-between items-end">
                  <button 
                    type="submit" 
                    disabled={formStatus === "submitting"}
                    className="bg-accent-green text-white px-8 py-4 rounded-xl font-display font-bold text-lg hover:bg-base-dark transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    {formStatus === "submitting" ? "Sende..." : "Anfrage absenden"}
                    {formStatus !== "submitting" && (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    )}
                  </button>

                  {/* Easteregg Figure hiding behind button */}
                  <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8, type: "spring" }}
                    className="w-24 md:w-32 pointer-events-none hidden sm:block"
                  >
                    <img src="/figur-transparent.png" alt="Festwirt Easteregg" className="w-full h-auto drop-shadow-md opacity-80" />
                  </motion.div>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
