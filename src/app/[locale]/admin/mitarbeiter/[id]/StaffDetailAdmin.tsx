"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";
import type { ContractRecord, StaffDocumentRecord, StaffRecord, StaffRole } from "@/types/domain";
import { DOCUMENT_KIND_LABELS } from "@/lib/required-documents";
import { getStaffErasureStatus, updateStaffAdmin, anonymizeStaffForErasure, eraseDeletableStaffData, deleteStaffHardDev, verifyStaffDocument } from "@/app/actions/staff";
import { verifyContract } from "@/app/actions/contracts";

type Detail = { member: StaffRecord; role: StaffRole | null; documents: StaffDocumentRecord[]; contracts: ContractRecord[] };

export default function StaffDetailAdmin({ detail, roles }: { detail: Detail; roles: StaffRole[] }) {
  const { member, role, documents, contracts } = detail;
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone || "",
    roleId: member.roleId || "",
    status: member.status,
    hourlyRateCents: member.hourlyRateCents,
    employmentType: member.employmentType,
    entryDate: member.entryDate ? new Date(member.entryDate).toISOString().slice(0, 10) : "",
    exitDate: member.exitDate ? new Date(member.exitDate).toISOString().slice(0, 10) : "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [erasure, setErasure] = useState<Awaited<ReturnType<typeof getStaffErasureStatus>> | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await updateStaffAdmin(member.id, { ...form, roleId: form.roleId || undefined, entryDate: form.entryDate || null, exitDate: form.exitDate || null });
      setMessage("Mitarbeiter gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const verifyDoc = async (id: string, status: "verified" | "rejected") => {
    setBusy(true);
    try { await verifyStaffDocument(id, status); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Dokument konnte nicht geprüft werden."); }
    finally { setBusy(false); }
  };

  const verify = async (id: string) => {
    setBusy(true);
    try { await verifyContract(id); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Vertrag konnte nicht geprüft werden."); }
    finally { setBusy(false); }
  };

  const checkErasure = async () => {
    setBusy(true); setMessage("");
    try { setErasure(await getStaffErasureStatus(member.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Prüfung fehlgeschlagen."); }
    finally { setBusy(false); }
  };

  const doPartialErasure = async () => {
    if (!confirm("Nur die sofort löschbaren Daten entfernen (Dokumente, Schichten, Einladungen)? Lohn-/Steuerdaten und Verträge bleiben erhalten.")) return;
    setBusy(true); setMessage("");
    try { await eraseDeletableStaffData(member.id); setErasure(await getStaffErasureStatus(member.id)); setMessage("Löschbare Daten entfernt. Lohn-/Steuerdaten bleiben aufbewahrt."); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen."); }
    finally { setBusy(false); }
  };

  const doFullErasure = async () => {
    if (!confirm("Person vollständig anonymisieren? Verträge & Dokumente werden gelöscht, Name/E-Mail durch Anonymisiert ersetzt. Das kann nicht rückgängig gemacht werden.")) return;
    setBusy(true); setMessage("");
    try { await anonymizeStaffForErasure(member.id); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Anonymisieren fehlgeschlagen."); }
    finally { setBusy(false); }
  };

  const isDev = process.env.NODE_ENV === "development";
  const devHardDelete = async () => {
    if (!confirm("DEV ONLY: Diesen Mitarbeiter ENDGÜLTIG löschen (Testmüll)? Alles (Verträge, Dokumente) verschwindet sofort. Nur für Tests!")) return;
    setBusy(true); setMessage("");
    try { await deleteStaffHardDev(member.id); router.push("/admin/mitarbeiter"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/mitarbeiter" className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline">&larr; Zurück zu Mitarbeiter</Link>
        <h1 className="text-3xl font-display font-black text-base-dark mt-2">{member.firstName} {member.lastName}</h1>
        <p className="text-base-dark/60">{member.email} · {role?.name || "Keine Rolle"} · {member.status}</p>
      </div>
      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}

      <form onSubmit={save} className="bg-white border border-border-light rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div><label className="block text-xs font-bold uppercase mb-1">Vorname</label><input value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Nachname</label><input value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Telefon</label><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Rolle</label><select value={form.roleId} onChange={event => setForm({ ...form, roleId: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3"><option value="">Keine</option>{roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Status</label><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3"><option value="invited">Eingeladen</option><option value="onboarding">Onboarding</option><option value="ready">Bereit</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Stundensatz (Cent)</label><input type="number" min={0} value={form.hourlyRateCents} onChange={event => setForm({ ...form, hourlyRateCents: Number(event.target.value) })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Beschäftigung</label><select value={form.employmentType} onChange={event => setForm({ ...form, employmentType: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3"><option value="minijob">Minijob</option><option value="short_term">Kurzfristig</option><option value="student">Werkstudent</option><option value="employed">Angestellt</option></select></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Eintritt</label><input type="date" value={form.entryDate} onChange={event => setForm({ ...form, entryDate: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div><label className="block text-xs font-bold uppercase mb-1">Austritt</label><input type="date" value={form.exitDate} onChange={event => setForm({ ...form, exitDate: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
        <div className="flex items-end"><button type="submit" disabled={busy} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">Speichern</button></div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-border-light rounded-2xl p-5">
          <h2 className="font-display font-bold text-xl mb-3">Dokumente ({documents.length})</h2>
          {documents.length === 0 ? <p className="text-sm text-base-dark/60">Keine Dokumente.</p> : <div className="space-y-2">{documents.map(document => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 border border-border-light rounded-xl p-3 text-sm">
              <div><p className="font-bold">{DOCUMENT_KIND_LABELS[document.kind] || document.kind}</p><p className="text-base-dark/50">{document.status === "verified" ? "Geprüft" : document.status === "pending" ? "Wird geprüft" : "Abgelehnt"} · {document.mimeType === "application/pdf" ? "PDF" : document.mimeType}</p></div>
              <div className="flex gap-2"><a href={`/api/team/file?documentId=${document.id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-green underline">Öffnen</a><button type="button" onClick={() => verifyDoc(document.id, "verified")} className="text-accent-green font-bold">Bestätigen</button><button type="button" onClick={() => verifyDoc(document.id, "rejected")} className="text-red-600 font-bold">Ablehnen</button></div>
            </div>
          ))}</div>}
        </section>

        <section className="bg-white border border-border-light rounded-2xl p-5">
          <h2 className="font-display font-bold text-xl mb-3">Verträge ({contracts.length})</h2>
          {contracts.length === 0 ? <p className="text-sm text-base-dark/60">Kein Vertrag.</p> : <div className="space-y-2">{contracts.map(contract => (
            <div key={contract.id} className="border border-border-light rounded-xl p-3 text-sm">
              <p className="font-bold">Version {contract.templateVersion} · {contract.status}</p>
              <p className="text-base-dark/50">{contract.signatureMode === "handwritten" ? "handschriftlich" : "digital"} · {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString("de-DE") : "nicht unterschrieben"}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {contract.signedFileUrl && <a href={`/api/team/file?contractId=${contract.id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-green underline">Unterschrift öffnen</a>}
                {contract.status === "signed" && <button type="button" onClick={() => verify(contract.id)} className="font-bold text-accent-green">Unterschrift bestätigen</button>}
              </div>
            </div>
          ))}</div>}
        </section>
      </div>

      <section className="bg-white border border-border-light rounded-2xl p-5">
        <h2 className="font-display font-bold text-xl mb-2">DSGVO · Löschung &amp; Anonymisierung</h2>
        <p className="text-sm text-base-dark/60 mb-3">&ldquo;Inaktiv&rdquo; sperrt nur den Zugang – die Daten bleiben da. Bei einer Lösch-Anfrage (Art. 17 DSGVO) musst du zusätzlich anonymisieren. Lohn-/Steuerdaten sind bis 10 Jahre nach Austritt aufzubewahren (§§ 147 AO, 257 HGB).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={checkErasure} disabled={busy} className="min-h-11 px-4 bg-white border border-border-light rounded-xl font-bold disabled:opacity-50">Lösch-Status prüfen</button>
          <button type="button" onClick={doPartialErasure} disabled={busy} className="min-h-11 px-4 border border-accent-green/40 text-accent-green rounded-xl font-bold disabled:opacity-50">Nur löschbare Daten entfernen</button>
          <button type="button" onClick={doFullErasure} disabled={busy || !erasure?.canFullyAnonymize} className="min-h-11 px-4 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50">Vollständig anonymisieren</button>
          {isDev && <button type="button" onClick={devHardDelete} disabled={busy} className="min-h-11 px-4 bg-purple-700 text-white rounded-xl font-bold disabled:opacity-50">🗑 Dev: Endgültig löschen</button>}
        </div>
        {erasure && (
          <div className="mt-3 text-sm space-y-2">
            {erasure.isAnonymized && <p className="font-bold text-accent-green">Bereits anonymisiert.</p>}
            <p className="text-xs text-base-dark/50">Austritt: {erasure.exitDate || "nicht erfasst"} · Aufbewahrung bis: {erasure.retentionUntil || "–"} {erasure.retentionActive ? "(noch aktiv)" : "(abgelaufen)"}</p>
            <p><strong>Sofort löschbar:</strong> {erasure.deletableNow.join(", ")}</p>
            {erasure.mustRetain.length > 0 && <p><strong>Muss aufbewahrt werden (steuerlich):</strong> {erasure.mustRetain.join(", ")}</p>}
            {erasure.retentionActive && <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">Voll-Anonymisierung ist blockiert, bis die Frist abgelaufen ist. Erfasse ggf. das Austrittsdatum oben und speichere es.</p>}
            {erasure.canFullyAnonymize && !erasure.isAnonymized && <p className="font-bold text-accent-green">Voll-Anonymisierung ist möglich.</p>}
          </div>
        )}
      </section>
    </div>
  );
}