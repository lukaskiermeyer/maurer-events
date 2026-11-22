"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Purpose = "invite" | "password_reset" | "totp_reset";

// Der Hash wird nach dem Lesen entfernt; sessionStorage hält den Token für
// Reloads im selben Tab, bis die Einrichtung abgeschlossen ist.
const SESSION_KEY = "admin-setup-token";

export default function SetupClient() {
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"load" | "pin" | "password" | "totp" | "codes" | "done-login">("load");
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const tokenConsumed = useRef(false);

  useEffect(() => {
    if (step === "codes" || step === "done-login") window.sessionStorage.removeItem(SESSION_KEY);
    else if (token) window.sessionStorage.setItem(SESSION_KEY, token);
  }, [token, step]);

  useEffect(() => {
    // StrictMode führt Effects doppelt aus: der Hash ist nach dem ersten Lauf
    // entfernt, der zweite darf den Token nicht mit "" überschreiben.
    if (tokenConsumed.current) return;
    tokenConsumed.current = true;
    const match = window.location.hash.match(/token=([^&]+)/);
    const raw = match ? decodeURIComponent(match[1]) : (window.sessionStorage.getItem(SESSION_KEY) || "");
    window.history.replaceState(null, "", window.location.pathname);
    if (raw) window.sessionStorage.setItem(SESSION_KEY, raw);
    setToken(raw);
    if (!raw) { setError("Kein Einrichtungs-Link gefunden. Bitte den Link aus der Mail oder dem Terminal verwenden."); return; }
    void validate(raw, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Fehler.");
    return data;
  };

  const validate = async (rawToken: string, pinValue: string | null) => {
    setBusy(true); setError("");
    try {
      const data = await post("/api/admin/setup/validate", { token: rawToken, pin: pinValue });
      setPurpose(data.purpose);
      setEmail(data.email);
      if (data.purpose === "password_reset") setStep("password");
      else if (data.purpose === "totp_reset") await startTotp(rawToken, pinValue);
      else setStep("password");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Fehler.";
      if (!pinValue && /PIN/i.test(message)) setStep("pin");
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    await validate(token, pin);
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== password2) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true); setError("");
    try {
      const data = await post("/api/admin/setup/password", { token, pin: pin || null, password });
      if (data.next === "login") { setStep("done-login"); return; }
      await startTotp(token, pin || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  };

  const startTotp = async (rawToken: string, pinValue: string | null) => {
    setBusy(true); setError("");
    try {
      const data = await post("/api/admin/setup/totp-start", { token: rawToken, pin: pinValue });
      setQr(data.qrDataUrl);
      setSecret(data.secret);
      setStep("totp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await post("/api/admin/setup/totp-confirm", { token, pin: pin || null, code });
      setCodes(data.recoveryCodes);
      setStep("codes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-8 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-1">Maurer Events</p>
          <h1 className="font-display font-black text-2xl text-base-dark">
            {purpose === "password_reset" ? "Passwort neu setzen" : purpose === "totp_reset" ? "Authenticator neu einrichten" : "Admin-Konto einrichten"}
          </h1>
          {email && <p className="text-sm text-base-dark/60 mt-1">{email}</p>}
        </div>

        {step === "pin" && (
          <form onSubmit={submitPin} className="space-y-4">
            <p className="text-sm text-base-dark/70">Bitte die PIN aus der Einrichtungs-Mail eingeben.</p>
            <input required value={pin} onChange={e => setPin(e.target.value)} placeholder="XXXX-XXXX" className="w-full bg-canvas-light border border-border-light rounded-lg p-3 tracking-widest focus:outline-none focus:border-accent-green" />
            <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">Weiter</button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <p className="text-sm text-base-dark/70">Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen. Keine Wiederholung aus bekannten Datenleaks.</p>
            <label className="block text-sm font-bold space-y-1">Neues Passwort
              <span className="flex gap-2">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 flex-1 bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="mt-1 min-h-11 px-3 rounded-lg border border-border-light text-xs font-bold" aria-pressed={showPassword}>{showPassword ? "Verbergen" : "Anzeigen"}</button>
              </span>
            </label>
            <label className="block text-sm font-bold space-y-1">Passwort bestätigen
              <input type={showPassword ? "text" : "password"} required value={password2} onChange={e => setPassword2(e.target.value)} className="mt-1 w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
            </label>
            <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Passwort setzen"}</button>
            {purpose === "password_reset" && <p className="text-xs text-base-dark/60">Danach geht es zurück zum Login – dein Authenticator-Code wird weiterhin verlangt.</p>}
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={submitTotp} className="space-y-4">
            <p className="text-sm text-base-dark/70">QR-Code mit Google Authenticator scannen (oder Schlüssel manuell eingaben) und den aktuellen 6-stelligen Code bestätigen.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR-Code für die Authenticator-App" className="w-48 h-48 mx-auto border border-border-light rounded-xl bg-white p-2" />}
            <p className="text-xs font-mono break-all bg-canvas-light border border-border-light rounded-lg p-2">{secret}</p>
            <input required inputMode="numeric" pattern="\d{6}" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="w-full bg-canvas-light border border-border-light rounded-lg p-3 tracking-widest focus:outline-none focus:border-accent-green" />
            <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">{busy ? "Wird geprüft…" : "Code bestätigen"}</button>
            <button type="button" disabled={busy} onClick={() => startTotp(token, pin || null)} className="w-full min-h-11 border border-border-light rounded-xl font-bold disabled:opacity-50">Neuen QR-Code erzeugen</button>
          </form>
        )}

        {step === "codes" && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-accent-green">Einrichtung abgeschlossen. Bitte Recovery-Codes jetzt sichern – sie werden nur einmal angezeigt.</p>
            <ul className="grid grid-cols-2 gap-2 text-sm font-mono bg-canvas-light border border-border-light rounded-xl p-3">
              {codes.map(c => <li key={c}>{c}</li>)}
            </ul>
            <button type="button" onClick={copyCodes} className="w-full min-h-11 border border-border-light rounded-xl font-bold">{copied ? "Kopiert ✓" : "Codes kopieren"}</button>
            <Link href="/admin/login" className="block w-full min-h-11 bg-accent-green text-white rounded-xl font-bold text-center leading-[44px]">Zum Login</Link>
          </div>
        )}

        {step === "done-login" && (
          <div className="space-y-4">
            <p className="text-sm text-base-dark/70">Passwort gesetzt. Der Reset hat alle Sitzungen beendet und nur das Passwort geändert – beim Login wird jetzt weiterhin dein TOTP-Code verlangt.</p>
            <Link href="/admin/login" className="block w-full min-h-11 bg-accent-green text-white rounded-xl font-bold text-center leading-[44px]">Zum Login</Link>
          </div>
        )}

        {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">{error}</p>}
      </div>
    </div>
  );
}
