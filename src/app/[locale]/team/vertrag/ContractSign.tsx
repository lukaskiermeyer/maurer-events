"use client";

import { useRef, useState } from "react";
import { attachSignedContract } from "@/app/actions/contracts";
import DropZone from "@/components/ui/DropZone";

export default function ContractSign({
  contractId,
  status,
  signedFileUrl,
}: {
  contractId: string;
  signatureMode: "text" | "handwritten";
  status: string;
  signedFileUrl: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const getCtx = () => canvasRef.current?.getContext("2d") || null;

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    drawingRef.current = true;
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
    updateLiveSignature();
  };
  const endDraw = () => { drawingRef.current = false; };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    updateLiveSignature(true);
  };

  const updateLiveSignature = (clear = false) => {
    const span = document.getElementById("sig-employee-line");
    if (!span) return;
    if (clear) {
      span.innerHTML = "";
      span.style.backgroundImage = "";
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    span.innerHTML = `<img src="${dataUrl}" alt="" style="height:100%;width:100%;object-fit:contain;" />`;
  };

  const submitCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) { setMessage("Bitte zuerst unterschreiben."); return; }
    setBusy(true);
    setMessage("");
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Unterschrift konnte nicht erstellt werden.");
      const data = new FormData();
      data.append("file", new File([blob], "unterschrift.png", { type: "image/png" }));
      data.append("contractId", contractId);
      const response = await fetch("/api/team/upload", { method: "POST", body: data, credentials: "include" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) { setMessage(result?.error || "Upload fehlgeschlagen."); return; }
      const attach = await attachSignedContract(contractId, result.fileUrl, result.sha256);
      if (!attach.success) { setMessage(attach.error || "Vertrag konnte nicht gespeichert werden."); return; }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unterschrift fehlgeschlagen.");
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
      const response = await fetch("/api/team/upload", { method: "POST", body: data, credentials: "include" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) { setMessage(result?.error || "Upload fehlgeschlagen."); return; }
      const attach = await attachSignedContract(contractId, result.fileUrl, result.sha256);
      if (!attach.success) { setMessage(attach.error || "Vertrag konnte nicht gespeichert werden."); return; }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
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
    <div className="no-print bg-white border border-border-light rounded-2xl p-5 space-y-6">
      <h2 className="font-display font-bold text-xl">Vertrag unterschreiben</h2>

      <div className="space-y-3">
        <p className="text-sm font-bold">Option 1: Unterschrift mit Stift/Stylus (digital)</p>
        <canvas
          ref={canvasRef}
          width={500}
          height={160}
          className="w-full max-w-[500px] h-40 border border-border-light rounded-xl bg-white touch-none cursor-crosshair"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
        <div className="flex gap-3">
          <button type="button" onClick={clearCanvas} className="bg-base-light text-base-dark px-4 py-2 rounded-xl font-bold text-sm">Löschen</button>
          <button type="button" onClick={submitCanvas} disabled={busy || !hasSignature} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird gespeichert…" : "Digital unterschreiben"}</button>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border-light">
        <p className="text-sm font-bold">Option 2: Ausdrucken, unterschreiben, einscannen und hochladen</p>
        <p className="text-sm text-base-dark/70">Drucke den Vertrag aus, unterschreibe ihn handschriftlich und lade die unterschriebene Seite als PDF oder Foto hoch.</p>
        <button type="button" onClick={() => window.print()} className="bg-base-dark text-white px-6 py-3 rounded-xl font-bold">Vertrag drucken</button>
        <form onSubmit={uploadSigned} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Unterschriebener Vertrag (PDF/Foto)</label>
            <DropZone accept="application/pdf,image/jpeg,image/png,image/webp" label={file ? file.name : "Datei hierher ziehen oder klicken"} onFiles={files => setFile(files[0] || null)} />
          </div>
          <button type="submit" disabled={busy || !file} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">{busy ? "Wird hochgeladen…" : "Unterschriebenen Vertrag hochladen"}</button>
        </form>
      </div>

      {message && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{message}</p>}
    </div>
  );
}