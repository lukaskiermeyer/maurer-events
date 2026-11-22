"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

type AdminRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  removedAt: string | null;
  passwordSetAt: string | null;
  totpEnrolledAt: string | null;
};

export default function AdminsSettings() {
  const dialog = useDialog();
  const toast = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<{ link: string; pin: string } | null>(null);
  const [resetEmail, setResetEmail] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/admins", { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (res.ok) setAdmins(data?.admins || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Kritische Aktionen verlangen frisches TOTP (<= 5 min).
  const ensureStepUp = async (): Promise<boolean> => {
    const code = await dialog.prompt({ title: "Bestätigung erforderlich", message: "Bitte deinen aktuellen 6-stelligen TOTP-Code eingaben, um die Aktion freizuschalten.", inputLabel: "TOTP-Code", confirmLabel: "Freischalten" });
    if (code === null) return false;
    const res = await fetch("/api/admin/auth/step-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.showToast(data?.error || "TOTP-Bestätigung fehlgeschlagen.", "error");
      return false;
    }
    return true;
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!await ensureStepUp()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }), credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.showToast(data?.error || "Einladung fehlgeschlagen.", "error"); return; }
      setInviteResult({ link: data.link, pin: data.pin });
      setInviteEmail("");
      toast.showToast("Einladung erstellt. PIN jetzt separat durchgeben – nicht in dieselbe Mail!", "warning", 8000);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const mailInvite = async (row: AdminRow) => {
    const ok = await dialog.confirm({ title: "Einrichtungs-Link mailen", message: `Neuen Einrichtungs-Link an ${row.email} senden? Ein ggf. alter Link wird damit ungültig. Die PIN erscheint danach einmalig hier und muss separat (Telefon/Messenger) durchgegeben werden.`, confirmLabel: "Mail senden" });
    if (!ok) return;
    if (!await ensureStepUp()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: row.email }), credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.showToast(data?.error || "Einladung fehlgeschlagen.", "error"); return; }
      toast.showToast(`Einrichtungs-Link an ${row.email} gesendet (72 h gültig).`, "success", 8000);
      await dialog.confirm({ title: "PIN einmalig – separat durchgeben", message: `PIN: ${data.pin}\nJetzt per Telefon/Messenger durchgeben – nicht in die Mail.`, confirmLabel: "Verstanden", cancelLabel: "Schließen" });
      void load();
    } finally {
      setBusy(false);
    }
  };

  const passwordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!await ensureStepUp()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resetEmail }), credentials: "include" });
      const data = await res.json().catch(() => null);
      toast.showToast(data?.message || "Reset-Mail versendet.", "success", 8000);
      setResetEmail("");
    } finally {
      setBusy(false);
    }
  };

  const totpReset = async () => {
    const email = await dialog.prompt({ title: "TOTP zurücksetzen (Danger Zone)", message: "E-Mail des betroffenen Admin-Kontos eintippen. Alle Sitzungen des Kontos werden beendet, Mails gehen an beide Konten.", inputLabel: "E-Mail", confirmLabel: "Weiter" });
    if (email === null) return;
    const ok = await dialog.confirm({ title: "TOTP-Reset bestätigen", message: `TOTP für ${email} wirklich neu einrichten? Der Zugang ist bis zur neuen Einrichtung gesperrt.`, danger: true, confirmLabel: "TOTP zurücksetzen" });
    if (!ok) return;
    if (!await ensureStepUp()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins/totp-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.showToast(data?.error || "TOTP-Reset fehlgeschlagen.", "error"); return; }
      await dialog.confirm({ title: "Setup-Link", message: `Diesen Link sicher an die Person übergeben (30 min gültig):\n${data.link}`, confirmLabel: "OK", cancelLabel: "Schließen" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: AdminRow) => {
    const ok = await dialog.confirm({ title: "Admin entfernen", message: `${row.email} wirklich entfernen? Alle Sitzungen werden widerrufen, Mails gehen an beide Konten.`, danger: true, confirmLabel: "Entfernen" });
    if (!ok) return;
    if (!await ensureStepUp()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: row.email }), credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.showToast(data?.error || "Entfernen fehlgeschlagen.", "error"); return; }
      toast.showToast("Admin entfernt.", "success");
      void load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border-light rounded-2xl p-5 shadow-sm overflow-x-auto">
        <h2 className="font-display font-bold text-xl mb-3">Admin-Konten</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-bold uppercase tracking-wider text-base-dark/50 border-b border-border-light">
            <tr>
              <th className="p-3">E-Mail</th>
              <th className="p-3">Status</th>
              <th className="p-3">Passwort</th>
              <th className="p-3">TOTP</th>
              <th className="p-3">Letzter Login</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {admins.map(row => (
              <tr key={row.id}>
                <td className="p-3 font-bold">{row.email}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">{row.passwordSetAt ? "gesetzt" : <span className="text-amber-700 font-bold">fehlt</span>}</td>
                <td className="p-3">{row.totpEnrolledAt ? "eingerichtet" : <span className="text-amber-700 font-bold">fehlt</span>}</td>
                <td className="p-3">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("de-DE") : "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-3 justify-end">
                    {row.status === "pending_enrollment" && (
                      <button type="button" disabled={busy} onClick={() => mailInvite(row)} className="text-xs font-bold text-accent-green underline disabled:opacity-50">Einrichtungs-Link mailen</button>
                    )}
                    {row.status !== "removed" && (
                      <button type="button" disabled={busy} onClick={() => remove(row)} className="text-xs font-bold text-red-600 underline disabled:opacity-50">Entfernen</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={invite} className="bg-white border border-border-light rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-display font-bold text-xl">Admin hinzufügen</h2>
          <p className="text-sm text-base-dark/60">Erzeugt Einrichtungs-Link und sendet ihn per Mail (72 h gültig). Die PIN erscheint einmalig hier und muss separat (Telefon/anderer Kanal) durchgegeben werden.</p>
          <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@domain.de" className="w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
          <button type="submit" disabled={busy} className="w-full min-h-11 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">Einladung erstellen</button>
          {inviteResult && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm">
              <p className="font-bold text-amber-800">PIN einmalig – jetzt separat durchgeben, nicht in die Mail:</p>
              <p className="font-mono text-lg tracking-widest">{inviteResult.pin}</p>
              <p className="text-xs break-all text-base-dark/70">{inviteResult.link}</p>
            </div>
          )}
        </form>

        <form onSubmit={passwordReset} className="bg-white border border-border-light rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-display font-bold text-xl">Passwort-Reset senden</h2>
          <p className="text-sm text-base-dark/60">Setzt NUR das Passwort zurück. TOTP bleibt unberührt und wird beim nächsten Login weiterhin verlangt – der Reset umgeht also keine 2FA. Alle Sitzungen des Kontos werden beendet.</p>
          <input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="name@domain.de" className="w-full bg-canvas-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green" />
          <button type="submit" disabled={busy} className="w-full min-h-11 bg-base-dark text-white rounded-xl font-bold disabled:opacity-50">Reset-Mail senden</button>
        </form>
      </div>

      <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="font-display font-bold text-xl text-red-700">Danger Zone: TOTP zurücksetzen</h2>
        <p className="text-sm text-base-dark/60">Nur für den Fall „Handy verloren“. Das Konto ist bis zur Neueinrichtung gesperrt. Nicht der Default-Weg – Passwort-Reset reicht bei vergessenem Passwort NICHT für 2FA.</p>
        <button type="button" disabled={busy} onClick={totpReset} className="min-h-11 px-5 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50">TOTP-Reset starten…</button>
      </div>
    </div>
  );
}
