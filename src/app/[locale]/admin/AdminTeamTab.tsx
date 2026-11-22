"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { TeamMember } from "@/types/domain";
import { createTeamMember, updateTeamMember, deleteTeamMember, moveTeamMember } from "@/app/actions/team";
import { uploadImage } from "@/lib/client-image-upload";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";

const EMPTY_FORM = { name: "", role: "", quote: "", imageUrl: "" };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler");

type MemberForm = typeof EMPTY_FORM;

function MemberFields({
  value,
  onChange,
  onPhoto,
  uploading,
}: {
  value: MemberForm;
  onChange: (next: MemberForm) => void;
  onPhoto: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-3 bg-base-light/50 p-4 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold mb-1 opacity-70">Name</label>
          <input type="text" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} className="w-full border border-border-light rounded-lg p-2 bg-white focus:outline-none focus:border-accent-green text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1 opacity-70">Position</label>
          <input type="text" value={value.role} onChange={e => onChange({ ...value, role: e.target.value })} className="w-full border border-border-light rounded-lg p-2 bg-white focus:outline-none focus:border-accent-green text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold mb-1 opacity-70">Zitat (Rückseite der Karte)</label>
        <textarea value={value.quote} onChange={e => onChange({ ...value, quote: e.target.value })} className="w-full border border-border-light rounded-lg p-2 bg-white focus:outline-none focus:border-accent-green text-sm min-h-[60px]" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {value.imageUrl ? (
          <span className="relative w-16 h-16 rounded-xl overflow-hidden border border-border-light shrink-0">
            <Image src={value.imageUrl} alt="" fill sizes="64px" className="object-cover" />
          </span>
        ) : (
          <span className="w-16 h-16 rounded-xl bg-base-light border border-border-light flex items-center justify-center text-[10px] opacity-50 text-center px-1 shrink-0">Kein Foto</span>
        )}
        <label className="text-sm font-bold bg-white border border-border-light px-4 py-2 rounded-lg hover:bg-base-light transition-colors cursor-pointer">
          {uploading ? "Lädt…" : "Foto hochladen"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }}
          />
        </label>
        {value.imageUrl && (
          <button type="button" onClick={() => onChange({ ...value, imageUrl: "" })} className="text-sm font-bold text-red-500 hover:underline">
            Foto entfernen
          </button>
        )}
        <span className="text-[11px] opacity-50">Ohne Foto zeigt die Karte den Anfangsbuchstaben.</span>
      </div>
    </div>
  );
}

export default function AdminTeamTab({ initialMembers }: { initialMembers: TeamMember[] }) {
  const toast = useToast();
  const dialog = useDialog();

  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>({ ...EMPTY_FORM });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MemberForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  // Kurzes Speicher-Icon nach Reihenfolge-Änderung / Speichern.
  const markSaved = (id: string) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedId(id);
    savedTimer.current = setTimeout(() => setSavedId(null), 1500);
  };

  // Gleiche Reihenfolge wie öffentlich auf „Über uns".
  const sorted = [...members].sort((a, b) => {
    const o = a.sortOrder - b.sortOrder;
    if (o !== 0) return o;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const patch = (m: TeamMember) => setMembers(prev => prev.map(x => (x.id === m.id ? m : x)));

  const handleMove = async (id: string, dir: -1 | 1) => {
    try {
      const list = await moveTeamMember(id, dir);
      setMembers(prev => prev.map(m => {
        const hit = list.find(x => x.id === m.id);
        return hit ? { ...m, sortOrder: hit.sortOrder } : m;
      }));
      markSaved(id);
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, role: m.role, quote: m.quote, imageUrl: m.imageUrl || "" });
  };

  const handleSave = async (id: string) => {
    if (!form.name.trim() || !form.role.trim() || !form.quote.trim()) {
      toast.showToast("Bitte Name, Position und Zitat ausfüllen.", "warning");
      return;
    }
    setSaving(true);
    try {
      const row = await updateTeamMember(id, { name: form.name, role: form.role, quote: form.quote, imageUrl: form.imageUrl || null });
      patch(row);
      setEditingId(null);
      markSaved(id);
      toast.showToast("Mitarbeiter gespeichert.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.role.trim() || !createForm.quote.trim()) {
      toast.showToast("Bitte Name, Position und Zitat ausfüllen.", "warning");
      return;
    }
    setSaving(true);
    try {
      const row = await createTeamMember({ name: createForm.name, role: createForm.role, quote: createForm.quote, imageUrl: createForm.imageUrl || null });
      setMembers(prev => [...prev, row]);
      setCreateForm({ ...EMPTY_FORM });
      setCreateOpen(false);
      markSaved(row.id);
      toast.showToast("Mitarbeiter angelegt.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
    setSaving(false);
  };

  const handleDelete = async (m: TeamMember) => {
    if (!await dialog.confirm({ title: "Mitarbeiter löschen", message: `„${m.name}“ wirklich aus „Über uns“ entfernen?`, danger: true, confirmLabel: "Löschen" })) return;
    try {
      await deleteTeamMember(m.id);
      setMembers(prev => prev.filter(x => x.id !== m.id));
      if (editingId === m.id) setEditingId(null);
      toast.showToast("Mitarbeiter gelöscht.", "success");
    } catch (e) { toast.showToast(errMsg(e), "error"); }
  };

  const handlePhoto = async (file: File, target: "edit" | "create") => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadImage(fd);
    setUploading(false);
    if (!res.success) { toast.showToast(res.error, "error"); return; }
    if (target === "edit") setForm(f => ({ ...f, imageUrl: res.url }));
    else setCreateForm(f => ({ ...f, imageUrl: res.url }));
  };

  const savedCheck = (
    <span className="w-6 h-6 rounded-full bg-accent-green text-white flex items-center justify-center shrink-0" title="Gespeichert" aria-label="Gespeichert">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
    </span>
  );

  return (
    <div className="relative min-h-[500px] pb-24 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-subhead text-2xl text-base-dark">Team &amp; Über uns</h3>
          <p className="text-xs font-bold opacity-60 mt-1">Reihenfolge = Anzeige auf „Über uns“ · mit ↑/↓ ändern · Name, Position und Zitat je Mitarbeiter</p>
        </div>
        <button onClick={() => setCreateOpen(p => !p)} className="inline-flex items-center gap-2 bg-accent-green text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-base-dark transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neuer Mitarbeiter
        </button>
      </div>

      {createOpen && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border-light shadow-sm space-y-4">
          <h4 className="font-subhead text-xl">Neuen Mitarbeiter anlegen</h4>
          <MemberFields value={createForm} onChange={setCreateForm} onPhoto={f => handlePhoto(f, "create")} uploading={uploading} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-green text-white hover:bg-base-dark transition-colors disabled:opacity-50">{saving ? "Speichert…" : "Anlegen"}</button>
            <button onClick={() => { setCreateOpen(false); setCreateForm({ ...EMPTY_FORM }); }} className="px-4 py-2 rounded-lg text-sm font-bold bg-base-light hover:bg-border-light transition-colors">Abbrechen</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((m, i) => (
          <div key={m.id} className="bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 p-3">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-base-light shrink-0">
                {m.imageUrl ? (
                  <Image src={m.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display font-black text-2xl text-accent-green/60 select-none">{m.name.charAt(0)}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base sm:text-lg truncate">{m.name}</h3>
                <p className="text-xs opacity-60 truncate">{m.role}</p>
                <p className="text-xs opacity-70 truncate mt-1">„{m.quote}“</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {savedId === m.id ? savedCheck : (
                  <span className="text-xs font-bold opacity-50 min-w-6 text-center" title="Position auf „Über uns“">{i + 1}</span>
                )}
                <button
                  onClick={() => handleMove(m.id, -1)}
                  disabled={i === 0}
                  aria-label={`${m.name} nach vorne`}
                  title="Nach vorne (Reihenfolge auf „Über uns“)"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-base-dark font-bold hover:bg-base-light transition-colors disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMove(m.id, 1)}
                  disabled={i === sorted.length - 1}
                  aria-label={`${m.name} nach hinten`}
                  title="Nach hinten (Reihenfolge auf „Über uns“)"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-base-dark font-bold hover:bg-base-light transition-colors disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => (editingId === m.id ? setEditingId(null) : startEdit(m))}
                  aria-label={`${m.name} bearbeiten`}
                  title="Bearbeiten"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-base-dark hover:bg-base-light transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  aria-label={`${m.name} löschen`}
                  title="Mitarbeiter löschen"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
            {editingId === m.id && (
              <div className="border-t border-border-light p-4 space-y-4">
                <MemberFields value={form} onChange={setForm} onPhoto={f => handlePhoto(f, "edit")} uploading={uploading} />
                <div className="flex gap-2">
                  <button onClick={() => handleSave(m.id)} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-green text-white hover:bg-base-dark transition-colors disabled:opacity-50">{saving ? "Speichert…" : "Speichern"}</button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg text-sm font-bold bg-base-light hover:bg-border-light transition-colors">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="py-16 text-center opacity-50 bg-white rounded-2xl border border-border-light shadow-sm">
            Noch keine Team-Stimmen. Lege Mitarbeiter mit Name, Position und Zitat an.
          </div>
        )}
      </div>
    </div>
  );
}