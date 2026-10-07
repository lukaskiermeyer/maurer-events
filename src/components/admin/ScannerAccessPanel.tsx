"use client";
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { saveScannerAccess, removeScannerAccess } from '@/app/actions/scannerAccess';

type Grant = { id: string; email: string; validUntil: Date };
export default function ScannerAccessPanel({ eventId, eventDate, grants }: { eventId: string; eventDate: Date; grants: Grant[] }) {
  const [email, setEmail] = useState('');
  const [until, setUntil] = useState(() => new Date(Math.min(Math.max(new Date(eventDate).getTime() + 2 * 86400000, Date.now() + 86400000), Date.now() + 89 * 86400000)).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  return (
    <section className="space-y-6 max-w-2xl">
      <div><h2 className="text-2xl font-black">Einlass-Team</h2><p className="mt-2 text-base-dark/65">Gib Helfern nur den Scanner für dieses Fest frei. Sie melden sich mit ihrer E-Mail und einem einmaligen Code an.</p></div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setMessage('');
        try {
          const result = await saveScannerAccess({ eventId, email, validUntil: new Date(`${until}T23:59:59`).toISOString() });
          setMessage(result.success ? 'Scanner-Zugang gespeichert. Die Person kann sich jetzt über den Team-Login anmelden.' : result.error || 'Speichern fehlgeschlagen.');
          if (result.success) { setEmail(''); router.refresh(); }
        } catch { setMessage('Zugang konnte nicht gespeichert werden. Bitte erneut versuchen.'); }
        finally { setBusy(false); }
      }}>
        <div><label htmlFor="scanner-email" className="block font-bold text-sm mb-2">E-Mail des Helfers</label><input id="scanner-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full min-h-12 border border-border-light rounded-xl px-3" /></div>
        <div><label htmlFor="scanner-until" className="block font-bold text-sm mb-2">Zugang bis einschließlich</label><input id="scanner-until" type="date" required value={until} onChange={e => setUntil(e.target.value)} className="w-full min-h-12 border border-border-light rounded-xl px-3" /></div>
        <button disabled={busy} className="sm:col-span-2 bg-accent-green text-white min-h-12 rounded-xl font-bold disabled:opacity-50">{busy ? 'Speichert…' : 'Scanner-Zugang freigeben'}</button>
      </form>
      {message && <p role="status" className="rounded-xl bg-canvas-light p-4 text-sm">{message}</p>}
      <div className="space-y-3">
        {grants.length === 0 && <p className="text-sm text-base-dark/60">Noch keine Helfer freigegeben.</p>}
        {grants.map(grant => <div key={grant.id} className="border border-border-light p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-bold break-all">{grant.email}</p><p className="text-sm text-base-dark/60">{new Date(grant.validUntil) < new Date() ? 'Abgelaufen' : 'Gültig'} bis {new Date(grant.validUntil).toLocaleDateString('de-DE')}</p></div>
          <button disabled={busy} className="min-h-11 px-4 rounded-lg bg-red-50 text-red-700 font-bold text-sm" onClick={async () => {
            setBusy(true);
            try { await removeScannerAccess(eventId, grant.id); setMessage('Scanner-Zugang widerrufen.'); router.refresh(); }
            catch { setMessage('Widerruf fehlgeschlagen. Bitte erneut versuchen.'); }
            finally { setBusy(false); }
          }}>Widerrufen</button>
        </div>)}
      </div>
      <p className="text-sm text-base-dark/60">Die Freigabe gilt nur fürs Scannen dieses Fests und endet automatisch am gewählten Datum. Ein Widerruf wirkt auch bei bereits angemeldeten Helfern.</p>
    </section>
  );
}
