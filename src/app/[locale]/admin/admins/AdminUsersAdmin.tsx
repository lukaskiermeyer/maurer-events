'use client';

import { useState } from 'react';
import { addAdminUser, removeAdminUser } from '@/app/actions/adminUsers';
import { resetAdminTotp } from '@/app/actions/authActions';
import type { AdminUserRow } from '@/app/actions/adminUsers';

const inputCls = 'w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green transition-colors';

export default function AdminUsersAdmin({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      const result = await addAdminUser(email);
      if (result.ok === false) {
        setMessage(result.error);
        return;
      }
      setUsers(prev => [...prev, result.created]);
      setEmail('');
      setMessage('Admin hinzugefügt. Die Person kann sich jetzt über /admin/login anmelden.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const handleRemove = async (id: string, mail: string) => {
    if (!confirm(`${mail} wirklich als Admin entfernen?`)) return;
    setBusy(true); setMessage('');
    try {
      await removeAdminUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setMessage('Admin entfernt.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const handleResetTotp = async (mail: string) => {
    if (!confirm(`2FA für ${mail} zurücksetzen? Die Person muss sich beim nächsten Login neu einrichten.`)) return;
    setBusy(true); setMessage('');
    try {
      const res = await resetAdminTotp(mail);
      if (!res.success) { setMessage(res.error || 'Zurücksetzen fehlgeschlagen.'); return; }
      setMessage(`2FA für ${mail} zurückgesetzt.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Zurücksetzen fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark">Administratoren</h1>
        <p className="mt-2 text-base-dark/65">E-Mails mit vollem Verwaltungszugriff. Diese Personen können sich über /admin/login anmelden und haben Zugriff auf alle Funktionen.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <p className="font-bold mb-1">Hinweis</p>
        <p>Admins aus der Umgebungsvariable <code>ADMIN_EMAILS</code> haben immer Zugriff und sind hier nicht aufgelistet. Hier angelegte Admins werden in der Datenbank gespeichert.</p>
      </div>

      <form className="grid gap-4" onSubmit={handleAdd}>
        <div>
          <label htmlFor="admin-email" className="block font-bold text-sm mb-2">Neue Admin-E-Mail</label>
          <input id="admin-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="name@example.com" />
        </div>
        <button disabled={busy} className="bg-accent-green text-white min-h-12 rounded-xl font-bold disabled:opacity-50">
          {busy ? 'Speichert…' : 'Admin hinzufügen'}
        </button>
      </form>

      {message && <p role="status" className="rounded-xl bg-canvas-light p-4 text-sm">{message}</p>}

      <div className="space-y-3">
        <h2 className="font-display font-bold text-xl">Datenbank-Admins ({users.length})</h2>
        {users.length === 0 && <p className="text-sm text-base-dark/60">Noch keine Admins in der Datenbank angelegt.</p>}
        {users.map(u => (
          <div key={u.id} className="border border-border-light p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold break-all">{u.email}</p>
              <p className="text-sm text-base-dark/60">
                Angelegt von {u.createdBy || '—'} am{' '}
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-DE') : '—'}
              </p>
            </div>
            <button disabled={busy} className="min-h-11 px-4 rounded-lg bg-amber-50 text-amber-700 font-bold text-sm" onClick={() => handleResetTotp(u.email)}>
              2FA zurücksetzen
            </button>
            <button disabled={busy} className="min-h-11 px-4 rounded-lg bg-red-50 text-red-700 font-bold text-sm" onClick={() => handleRemove(u.id, u.email)}>
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}