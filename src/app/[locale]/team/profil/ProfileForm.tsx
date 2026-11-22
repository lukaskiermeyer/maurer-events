"use client";

import { useState } from "react";
import { updateMyProfile } from "@/app/actions/staff";

type Initial = { firstName: string; lastName: string; phone: string; street: string; houseNumber: string; zip: string; city: string; iban: string; bic: string; taxClass: string; healthInsurance: string };

export default function ProfileForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      await updateMyProfile(form);
      setMessage("Profil gespeichert.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const cls = "w-full bg-base-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Profil</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Meine Daten</h1>
        <p className="text-base-dark/60 mt-1">Aktualisiere deine persönlichen Angaben.</p>
      </div>
      <form onSubmit={save} className="bg-white border border-border-light rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-bold uppercase mb-1">Vorname</label><input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Nachname</label><input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Telefon</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Straße</label><input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Hausnummer</label><input value={form.houseNumber} onChange={e => setForm({ ...form, houseNumber: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">PLZ</label><input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Ort</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">IBAN</label><input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">BIC</label><input value={form.bic} onChange={e => setForm({ ...form, bic: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Steuerklasse</label><input value={form.taxClass} onChange={e => setForm({ ...form, taxClass: e.target.value })} className={cls} /></div>
          <div><label className="block text-xs font-bold uppercase mb-1">Krankenkasse</label><input value={form.healthInsurance} onChange={e => setForm({ ...form, healthInsurance: e.target.value })} className={cls} /></div>
        </div>
        <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Speichern"}</button>
        {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
      </form>
    </div>
  );
}
