"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { EventDocument } from "@/types/domain";
import { deleteEventDocument } from "@/app/actions/eventDocuments";

function kindLabel(kind: string) {
  return kind === "program" ? "Programm" : "Speisekarte";
}

export default function EventDocumentsPanel({ eventId, initialDocuments }: { eventId: string; initialDocuments: EventDocument[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);
  const [kind, setKind] = useState<"menu" | "program">("menu");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "warning"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setMessage({ kind: "error", text: "Bitte eine Datei auswählen." }); return; }
    if (file.size > 15 * 1024 * 1024) { setMessage({ kind: "error", text: "Datei zu groß (max 15 MB)." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("eventId", eventId);
      form.append("kind", kind);
      form.append("title", title || file.name.replace(/\.[^.]+$/, ""));
      form.append("isPublic", String(isPublic));
      form.append("file", file);
      const response = await fetch("/api/admin/documents", { method: "POST", body: form, credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage({ kind: "error", text: data?.error || "Upload fehlgeschlagen." });
        return;
      }
      setDocuments(current => [...current, data.document]);
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setMessage(data.warning
        ? { kind: "warning", text: data.warning }
        : { kind: "ok", text: "Dokument hochgeladen." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (document: EventDocument) => {
    if (!confirm(`„${document.title}“ wirklich löschen?`)) return;
    setBusy(true);
    try {
      await deleteEventDocument(document.id);
      setDocuments(current => current.filter(item => item.id !== document.id));
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Löschen fehlgeschlagen." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="bg-canvas-light border border-border-light rounded-2xl p-5 space-y-4">
        <h2 className="font-display font-bold text-xl">Dokument hinzufügen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Art</label>
            <select value={kind} onChange={event => setKind(event.target.value as "menu" | "program")} className="w-full bg-white border border-border-light rounded-lg p-3">
              <option value="menu">Speisekarte</option>
              <option value="program">Programm / Bands</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Titel (optional)</label>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={150} placeholder="z.B. Speisekarte 2026" className="w-full bg-white border border-border-light rounded-lg p-3" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Datei (PDF, JPG, PNG, WebP · max. 15 MB)</label>
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} className="w-full bg-white border border-border-light rounded-lg p-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} className="w-5 h-5 accent-accent-green" />
          Öffentlich auf der Website anzeigen
        </label>
        <button type="submit" disabled={busy || !file} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-base-dark transition-colors">
          {busy ? "Wird hochgeladen…" : "Hochladen"}
        </button>
        {message && (
          <p className={`text-sm font-bold rounded-xl p-3 ${message.kind === "ok" ? "bg-accent-green/10 text-accent-green" : message.kind === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.text}
          </p>
        )}
      </form>

      <div>
        <h2 className="font-display font-bold text-xl mb-3">Dokumente ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className="bg-white border border-border-light rounded-2xl p-8 text-center text-base-dark/60">Noch keine Dokumente hinterlegt.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map(document => (
              <article key={document.id} className="bg-white border border-border-light rounded-2xl overflow-hidden">
                <div className="relative aspect-[3/4] bg-canvas-light">
                  {document.previewUrl ? (
                    <Image src={document.previewUrl} alt={document.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <span className="font-display font-black text-2xl text-accent-green">PDF</span>
                      <span className="text-xs text-base-dark/60 mt-2">Keine Vorschau verfügbar</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-accent-wood">{kindLabel(document.kind)}</p>
                      <h3 className="font-bold break-words">{document.title}</h3>
                      <p className="text-xs text-base-dark/50">{document.isPublic ? "Öffentlich" : "Intern"} · {Math.round((document.sizeBytes || 0) / 1024)} KB</p>
                    </div>
                    <button type="button" onClick={() => remove(document)} disabled={busy} className="text-red-600 text-sm font-bold hover:underline disabled:opacity-50">Löschen</button>
                  </div>
                  <a href={`/api/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm font-bold text-accent-green underline underline-offset-4">Datei öffnen</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}