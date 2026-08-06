"use client";

import { useState } from "react";
import { requestOtp, verifyOtp, bypassLoginForStaging } from "@/app/actions/authActions"; // <-- Neue Action importiert
import { Turnstile } from "@marsidev/react-turnstile";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await requestOtp(email);
      if (res.success) {
        setStep("code");
      } else {
        setError(res.error || "Ein unerwarteter Fehler ist aufgetreten.");
      }
    } catch (err) {
      setError("Verbindungsfehler.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!turnstileToken) {
      setError("Bitte bestätige, dass du kein Roboter bist.");
      setLoading(false);
      return;
    }

    try {
      const res = await verifyOtp(email, code, turnstileToken);
      if (res.success) {
        router.push("/admin");
      } else {
        setError(res.error || "Ungültiger Code.");
      }
    } catch (err) {
      setError("Verbindungsfehler.");
    } finally {
      setLoading(false);
    }
  };

  // NEU: Die Funktion für den Skip-Knopf
  const handleSkipLogin = async () => {
    setLoading(true);
    try {
      const res = await bypassLoginForStaging();
      if (res.success) {
        router.push("/admin");
      } else {
        setError(res.error || "Bypass fehlgeschlagen.");
      }
    } catch (err) {
      setError("Verbindungsfehler beim Bypass.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen bg-base-light flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-border-light">
          <h1 className="text-3xl font-black text-center mb-2">Admin <span className="text-accent-green">Login</span></h1>
          <p className="text-center text-sm text-base-dark/70 mb-8">
            Sicherer Zugang für Administratoren
          </p>

          {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold mb-6 text-center">
                {error}
              </div>
          )}

          {step === "email" && (
              <motion.form
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleRequestOtp}
                  className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">
                    E-Mail Adresse
                  </label>
                  <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dein.name@maurer-events.com"
                      className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green"
                  />
                </div>

                <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "Wird gesendet..." : "Code anfordern"}
                </button>
              </motion.form>
          )}

          {step === "code" && (
              <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">
                    6-stelliger Code
                  </label>
                  <input
                      type="text"
                      required
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-base-dark/60 mt-2 text-center">
                    Der Code wurde an {email} gesendet.
                  </p>
                </div>

                <div className="flex justify-center">
                  <Turnstile
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                      onSuccess={(token) => setTurnstileToken(token)}
                  />
                </div>

                <button
                    type="submit"
                    disabled={loading || code.length !== 6 || !turnstileToken}
                    className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "Wird geprüft..." : "Einloggen"}
                </button>

                <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="w-full text-center text-sm text-base-dark/60 hover:text-accent-green underline mt-4"
                >
                  Zurück
                </button>
              </motion.form>
          )}

          {/* NEU: Der Skip-Knopf, der nur in Staging/Dev auftaucht */}
          {process.env.NODE_ENV !== "production" && (
              <div className="mt-8 pt-6 border-t border-border-light">
                <button
                    onClick={handleSkipLogin}
                    type="button"
                    disabled={loading}
                    className="w-full bg-yellow-400 text-yellow-900 font-bold uppercase tracking-widest py-3 rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                >
                  🚀 Skip Login (Staging)
                </button>
                <p className="text-center text-[10px] text-base-dark/40 mt-2">
                  Nur sichtbar in NODE_ENV !== "production"
                </p>
              </div>
          )}

        </div>
      </div>
  );
}