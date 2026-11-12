"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { acceptStaffInvite } from "@/app/actions/staffAuth";

export default function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== repeat) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await acceptStaffInvite({ token, password });
      if (!result.success) { setError(result.error || "Einladung konnte nicht angenommen werden."); return; }
      router.replace("/team/onboarding");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-border-light rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Maurer Events</p>
      <h1 className="text-3xl font-display font-black text-base-dark mb-2">Einladung annehmen</h1>
      <p className="text-sm text-base-dark/60 mb-6">Lege dein Passwort fest und starte danach dein Onboarding.</p>
      {!token ? (
        <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">Der Einladungslink ist unvollständig.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-bold uppercase mb-1">Passwort (min. 10 Zeichen)</label><input type="password" required minLength={10} value={password} onChange={event => setPassword(event.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Passwort wiederholen</label><input type="password" required minLength={10} value={repeat} onChange={event => setRepeat(event.target.value)} className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
          {error && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Passwort setzen"}</button>
        </form>
      )}
    </div>
  );
}