"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginClient() {
  const router = useRouter();
  const [csrf, setCsrf] = useState("");
  const [step, setStep] = useState<"password" | "totp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryLeft, setRecoveryLeft] = useState<number | null>(null);
  const [csrfToken, setCsrfToken] = useState("");

  // CSRF Double-Submit: zufälliger Wert in einem lesbaren Cookie + im Request-Body.
  useEffect(() => {
    const existing = document.cookie.split("; ").find(c => c.startsWith("adm_csrf="))?.split("=")[1];
    if (existing) {
      setCsrf(existing);
      return;
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const value = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `adm_csrf=${value}; Path=/; Max-Age=3600; SameSite=Strict${secure}`;
    setCsrf(value);
  }, []);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-csrf": csrf },
        body: JSON.stringify({ email, password, csrf }),
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || "Anmeldung fehlgeschlagen."); return; }
      if (data?.trusted) { router.push("/admin"); router.refresh(); return; }
      setCsrfToken(data?.csrfToken || "");
      setStep("totp");
    } catch {
      setError("Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-csrf": csrfToken },
        body: JSON.stringify({ code, trustDevice, csrf: csrfToken }),
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || "Code ungültig."); return; }
      if (typeof data?.recoveryLeft === "number") setRecoveryLeft(data.recoveryLeft);
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Prüfung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <form onSubmit={step === "password" ? submitPassword : submitTotp} className="w-full max-w-md bg-white border border-border-light rounded-2xl shadow-sm p-6 sm:p-8 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-1">Maurer Events</p>
          <h1 className="font-display font-black text-2xl text-base-dark">Admin-Login</h1>
        </div>

        {step === "password" ? (
          <>
            <label className="block text-sm font-bold space-y-1">E-Mail
              <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
            </label>
            <label className="block text-sm font-bold space-y-1">Passwort
              <span className="flex gap-2">
                <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 flex-1 bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="mt-1 min-h-11 px-3 rounded-lg border border-border-light text-xs font-bold" aria-pressed={showPassword}>{showPassword ? "Verbergen" : "Anzeigen"}</button>
              </span>
            </label>
            <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">{busy ? "Wird geprüft…" : "Weiter"}</button>
          </>
        ) : (
          <>
            <p className="text-sm text-base-dark/70">Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben{useRecovery ? "" : " – oder einen Recovery-Code verwenden"}.</p>
            <label className="block text-sm font-bold space-y-1">{useRecovery ? "Recovery-Code" : "TOTP-Code"}
              <input
                required
                inputMode={useRecovery ? "text" : "numeric"}
                pattern={useRecovery ? undefined : "\\d{6}"}
                autoComplete="one-time-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="mt-1 w-full bg-canvas-light border border-border-light rounded-lg p-3 tracking-widest focus:outline-none focus:border-accent-green"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input type="checkbox" checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)} className="w-5 h-5 accent-accent-green" />
              Dieses Gerät 30 Tage merken (überspringt nur den Code, nie das Passwort)
            </label>
            <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">{busy ? "Wird geprüft…" : "Anmelden"}</button>
            <button type="button" onClick={() => { setUseRecovery(v => !v); setCode(""); setError(""); }} className="w-full min-h-11 border border-border-light rounded-xl font-bold text-sm">
              {useRecovery ? "Zurück zum TOTP-Code" : "Recovery-Code verwenden"}
            </button>
          </>
        )}

        {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">{error}</p>}
        {recoveryLeft !== null && recoveryLeft <= 3 && (
          <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Nur noch {recoveryLeft} Recovery-Codes übrig – bitte beim Festwirt neue Codes anfordern.</p>
        )}
        <p className="text-xs text-base-dark/50">Passwort vergessen? Reset-Link vom Festwirt anfordern – dein TOTP bleibt auch nach dem Reset Pflicht.</p>
        {process.env.NODE_ENV === "development" && (
          <Link href="/api/admin/auth/dev-login" className="block text-center text-xs text-amber-700 hover:text-amber-900 underline">
            Dev-Admin-Login (nur Entwicklung)
          </Link>
        )}
        <p className="text-xs text-base-dark/50"><Link href="/" className="underline">Zur Website</Link></p>
      </form>
    </div>
  );
}
