"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordWithToken } from "@/app/actions/staffAuth";

export default function PasswordResetPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeat) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true); setError("");
    try {
      const res = await resetPasswordWithToken(token, password);
      if (!res.success) { setError(res.error || "Zurücksetzen fehlgeschlagen."); return; }
      setDone(true);
      setTimeout(() => router.replace("/team/login"), 2000);
    } finally { setBusy(false); }
  };

  if (done) return <div className="max-w-md mx-auto mt-10 bg-white border border-border-light rounded-3xl p-6 text-center"><p className="font-bold text-accent-green">Passwort gesetzt. Du wirst zum Login weitergeleitet…</p></div>;

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-border-light rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Maurer Events</p>
      <h1 className="text-3xl font-display font-black text-base-dark mb-2">Neues Passwort</h1>
      <p className="text-sm text-base-dark/60 mb-6">Lege dein neues Passwort fest (min. 10 Zeichen).</p>
      {!token ? <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">Der Link ist unvollständig.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-bold uppercase mb-1">Neues Passwort</label><input type="password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Wiederholen</label><input type="password" required minLength={10} value={repeat} onChange={e => setRepeat(e.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
          {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Passwort setzen"}</button>
        </form>
      )}
      <p className="text-xs mt-3"><a href="/team/login" className="text-accent-green underline">Zurück zum Login</a></p>
    </div>
  );
}
