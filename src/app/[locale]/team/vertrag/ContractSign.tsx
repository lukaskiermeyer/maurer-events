"use client";

import { useState } from "react";
import { attachSignedContract, signContractText } from "@/app/actions/contracts";

export default function ContractSign({
  contractId,
  signatureMode,
  status,
  signedFileUrl,
  memberName,
}: {
  contractId: string;
  signatureMode: "text" | "handwritten";
  status: string;
  signedFileUrl: string | null;
  memberName: string;
}) {
  const [name, setName] = useState(memberName);
  const [accepted, setAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const signText = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accepted) { setMessage("Bitte den Vertrag bestätigen."); return; }
    setBusy(true);
    setMessage("");
    try {
      const result = await signContractText(contractId, name);
      if (!result.success) { setMessage(result.error || "Unterschrift fehlgeschlagen."); return; }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  const uploadSigned = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setMessage("Bitte den unterschriebenen Vertrag auswählen."); return; }
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("contractId", contractId);
      const response = await fetch("/api/team/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) { setMessage(result?.error || "Upload fehlgeschlagen."); return; }
      const attach = await attachSignedContract(contractId, result.fileUrl, result.sha256);
      if (!attach.success) { setMessage(attach.error || "Vertrag konnte nicht gespeichert werden."); return; }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  if (status === "signed" || status === "verified") {
    return (
      <div className="no-print bg-accent-green/10 border border-accent-green/30 rounded-2xl p-5">
        <p className="font-bold text-accent-green">Vertrag unterschrieben.</p>
        <p className="text-sm text-base-dark/60 mt-1">{status === "verified" ? "Die Unterschrift wurde vom Festwirt geprüft." : "Der Festwirt prüft die Unterschrift noch."}</p>
        {signedFileUrl && <a href={signedFileUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm font-bold text-accent-green underline">Unterschriebene Datei öffnen</a>}
      </div>
    );
  }

  return (
    <div className="no-print bg-white border border-border-light rounded-2xl p-5 space-y-4">
      <h2 className="font-display font-bold text-xl">Vertrag unterschreiben</h2>
      {signatureMode === "text" ? (
        <form onSubmit={signText} className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 w-5 h-5 accent-accent-green" />
            <span>Ich habe den Vertrag gelesen und akzeptiere ihn.</span>
          </label>
          <div><label className="block text-xs font-bold uppercase mb-1">Vollständiger Name</label><input required value={name} onChange={event => setName(event.target.value)} className="w-full max-w-md bg-base-light border border-border-light rounded-lg p-3" /></div>
          <button type="submit" disabled={busy} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird unterschrieben…" : "Digital unterschreiben"}</button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-base-dark/70">Dieser Vertrag muss handschriftlich unterschrieben werden. Drucke ihn aus, unterschreibe ihn und lade die unterschriebene Seite wieder hoch.</p>
          <button type="button" onClick={() => window.print()} className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold">Vertrag drucken</button>
          <form onSubmit={uploadSigned} className="space-y-3">
            <div><label className="block text-xs font-bold uppercase mb-1">Unterschriebener Vertrag (PDF/Foto)</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} className="w-full bg-base-light border border-border-light rounded-lg p-2 text-sm" /></div>
            <button type="submit" disabled={busy || !file} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird hochgeladen…" : "Unterschriebenen Vertrag hochladen"}</button>
          </form>
        </div>
      )}
      {message && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{message}</p>}
    </div>
  );
}