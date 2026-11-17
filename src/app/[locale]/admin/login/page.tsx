"use client";

import { useState } from "react";
import { requestAdminLogin, verifyAdminTotp, verifyAdminRecoveryCode, verifyAdminEnrollmentOtp, completeAdminTotpEnrollment, devBypassLogin } from "@/app/actions/authActions";
import { Turnstile } from "@marsidev/react-turnstile";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Step = "email" | "totp" | "recovery" | "email-otp" | "enroll" | "recovery-codes";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [trustDevice, setTrustDevice] = useState(true);

  // enrollment data
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const resetCaptcha = () => { setTurnstileToken(""); setCaptchaVersion(v => v + 1); };

  const handleRequestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await requestAdminLogin(email, turnstileToken);
      if (!res.success) { setError(res.error || "Fehler."); return; }
      if (res.step === "done") { router.push(res.destination || "/admin"); router.refresh(); return; }
      if (res.step === "totp") setStep("totp");
      else if (res.step === "email-otp") setStep("email-otp");
      else setStep("totp");
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); resetCaptcha(); }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (!turnstileToken) { setError("Bitte bestätige, dass du kein Roboter bist."); setLoading(false); resetCaptcha(); return; }
    try {
      const res = await verifyAdminTotp(email, code, trustDevice, turnstileToken);
      if (res.success) {
        if (res.destination) { router.push(res.destination); router.refresh(); }
      } else { setError(res.error || "Ungültiger Code."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); resetCaptcha(); setCode(""); }
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (!turnstileToken) { setError("Bitte bestätige, dass du kein Roboter bist."); setLoading(false); resetCaptcha(); return; }
    try {
      const res = await verifyAdminRecoveryCode(email, code, trustDevice, turnstileToken);
      if (res.success) {
        if (res.destination) { router.push(res.destination); router.refresh(); }
      } else { setError(res.error || "Ungültiger Recovery-Code."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); resetCaptcha(); setCode(""); }
  };

  const handleVerifyEnrollmentOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (!turnstileToken) { setError("Bitte bestätige, dass du kein Roboter bist."); setLoading(false); resetCaptcha(); return; }
    try {
      const res = await verifyAdminEnrollmentOtp(email, code, turnstileToken);
      if (res.success) {
        setQrDataUrl(res.qrDataUrl || "");
        setSecret(res.secret || "");
        setStep("enroll");
      } else { setError(res.error || "Ungültiger Code."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); resetCaptcha(); setCode(""); }
  };

  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (!turnstileToken) { setError("Bitte bestätige, dass du kein Roboter bist."); setLoading(false); resetCaptcha(); return; }
    try {
      const res = await completeAdminTotpEnrollment(email, code, trustDevice, turnstileToken);
      if (res.success) {
        if (res.recoveryCodes && res.recoveryCodes.length) {
          setRecoveryCodes(res.recoveryCodes);
          setStep("recovery-codes");
        } else if (res.destination) {
          router.push(res.destination); router.refresh();
        }
      } else { setError(res.error || "Ungültiger Code."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); resetCaptcha(); setCode(""); }
  };

  const handleDevBypass = async () => {
    setLoading(true);
    try {
      const res = await devBypassLogin();
      if (res.success) { router.push("/admin"); router.refresh(); }
      else { setError(res.error || "Bypass failed."); }
    } catch { setError("Dev Bypass error."); }
    finally { setLoading(false); resetCaptcha(); }
  };

  return (
    <div className="min-h-screen bg-base-light flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-border-light">
        <h1 className="text-3xl font-black text-center mb-2">Team <span className="text-accent-green">Login</span></h1>
        <p className="text-center text-sm text-base-dark/70 mb-8">
          Sicherer Zugang für Festwirt und Einlass-Team
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold mb-6 text-center">{error}</div>
        )}

        <div className="flex justify-center mb-6">
          <Turnstile key={captchaVersion} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
            onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} onError={() => setTurnstileToken('')}
            options={{ action: 'admin-login' }} />
        </div>

        {step === "email" && (
          <motion.form initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleRequestLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">E-Mail Adresse</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dein.name@maurer-events.com"
                className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green" />
            </div>
            <button type="submit" disabled={loading || !email || !turnstileToken}
              className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">
              {loading ? "Wird geprüft..." : "Weiter"}
            </button>
          </motion.form>
        )}

        {step === "totp" && (
          <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleVerifyTotp} className="space-y-6">
            <div>
              <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Authenticator-Code</label>
              <input type="text" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green text-center text-2xl tracking-widest font-mono" />
              <p className="text-xs text-base-dark/60 mt-2 text-center">6-stelliger Code aus Google Authenticator für {email}.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-base-dark/70">
              <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
              Dieses Gerät 7 Tage merken
            </label>
            <button type="submit" disabled={loading || code.length !== 6 || !turnstileToken}
              className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">
              {loading ? "Wird geprüft..." : "Einloggen"}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep("recovery"); setCode(""); }} className="flex-1 text-center text-xs text-base-dark/60 hover:text-accent-green underline">
                Recovery-Code verwenden
              </button>
              <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="flex-1 text-center text-xs text-base-dark/60 hover:text-accent-green underline">
                Zurück
              </button>
            </div>
          </motion.form>
        )}

        {step === "recovery" && (
          <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleVerifyRecovery} className="space-y-6">
            <div>
              <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Recovery-Code</label>
              <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX"
                className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green text-center font-mono" />
              <p className="text-xs text-base-dark/60 mt-2 text-center">Einmalig verwendbarer Notfall-Code.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-base-dark/70">
              <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
              Dieses Gerät 7 Tage merken
            </label>
            <button type="submit" disabled={loading || code.trim().length < 8 || !turnstileToken}
              className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">
              {loading ? "Wird geprüft..." : "Einloggen"}
            </button>
            <button type="button" onClick={() => { setStep("totp"); setCode(""); }} className="w-full text-center text-xs text-base-dark/60 hover:text-accent-green underline">
              Zurück zum Authenticator-Code
            </button>
          </motion.form>
        )}

        {step === "email-otp" && (
          <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleVerifyEnrollmentOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">6-stelliger E-Mail-Code</label>
              <input type="text" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green text-center text-2xl tracking-widest font-mono" />
              <p className="text-xs text-base-dark/60 mt-2 text-center">Der Code wurde an {email} gesendet (für 2FA-Einrichtung).</p>
            </div>
            <button type="submit" disabled={loading || code.length !== 6 || !turnstileToken}
              className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">
              {loading ? "Wird geprüft..." : "Weiter"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="w-full text-center text-xs text-base-dark/60 hover:text-accent-green underline">
              Zurück
            </button>
          </motion.form>
        )}

        {step === "enroll" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <p className="text-sm text-base-dark/70 text-center">Scanne den QR-Code mit Google Authenticator (oder einer kompatiblen App).</p>
            {qrDataUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="TOTP QR-Code" className="w-48 h-48 border border-border-light rounded-xl" />
              </div>
            )}
            <div>
              <p className="text-xs text-base-dark/60 text-center mb-1">Oder manuell eingeben:</p>
              <code className="block text-center text-xs font-mono bg-canvas-light rounded-xl p-2 break-all">{secret}</code>
            </div>
            <form onSubmit={handleCompleteEnrollment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold uppercase tracking-widest text-accent-green mb-3">Erster Code aus der App</label>
                <input type="text" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                  className="w-full bg-canvas-light border border-border-light rounded-xl px-4 py-3 focus:outline-none focus:border-accent-green text-center text-2xl tracking-widest font-mono" />
              </div>
              <label className="flex items-center gap-2 text-sm text-base-dark/70">
                <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
                Dieses Gerät 7 Tage merken
              </label>
              <button type="submit" disabled={loading || code.length !== 6 || !turnstileToken}
                className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50">
                {loading ? "Wird geprüft..." : "2FA aktivieren"}
              </button>
            </form>
          </motion.div>
        )}

        {step === "recovery-codes" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <p className="text-sm font-bold text-red-600 text-center">Speichere diese Recovery-Codes jetzt. Sie werden nur einmal angezeigt.</p>
            <div className="bg-canvas-light rounded-xl p-4 font-mono text-xs grid grid-cols-2 gap-1">
              {recoveryCodes.map((c) => (<div key={c}>{c}</div>))}
            </div>
            <button type="button" onClick={() => { router.push("/admin"); router.refresh(); }}
              className="w-full bg-accent-green text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-base-dark transition-colors">
              Weiter zum Admin-Bereich
            </button>
          </motion.div>
        )}

        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 pt-6 border-t border-border-light text-center">
            <p className="text-xs text-base-dark/50 mb-3">🛠 Development Mode</p>
            <button type="button" onClick={handleDevBypass} disabled={loading}
              className="w-full bg-base-dark text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
              Admin Login Skip (DEV ONLY)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}