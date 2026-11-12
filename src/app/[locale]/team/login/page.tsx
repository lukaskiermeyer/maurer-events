"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { staffLogin } from "@/app/actions/staffAuth";

export default function TeamLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await staffLogin({ email, password });
      if (!result.success) { setError(result.error || "Anmeldung fehlgeschlagen."); return; }
      router.replace("/team");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-border-light rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Maurer Events</p>
      <h1 className="text-3xl font-display font-black text-base-dark mb-2">Team-Login</h1>
      <p className="text-sm text-base-dark/60 mb-6">Melde dich mit deiner E-Mail und deinem Passwort an.</p>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="block text-xs font-bold uppercase mb-1">E-Mail</label><input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Passwort</label><input type="password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
        {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Anmeldung…" : "Anmelden"}</button>
      </form>
      <p className="text-xs text-base-dark/50 mt-5">Passwort vergessen? Bitte beim Festwirt melden.</p>
    </div>
  );
}