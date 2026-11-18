"use client";

import { useState } from "react";
import { updateContractOrt } from "@/app/actions/contracts";

export default function OrtInput({ contractId, initialOrt }: { contractId: string; initialOrt: string }) {
  const [ort, setOrt] = useState(initialOrt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await updateContractOrt(contractId, ort);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ort konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print bg-white border border-border-light rounded-2xl p-5 space-y-3">
      <label className="block text-xs font-bold uppercase mb-1">Ort (für den Vertrag)</label>
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={ort}
          onChange={(e) => setOrt(e.target.value)}
          placeholder="z. B. München"
          className="flex-1 min-w-[200px] bg-base-light border border-border-light rounded-lg p-3 focus:outline-none focus:border-accent-green"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="bg-accent-green text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"
        >
          {busy ? "Wird gespeichert…" : "Ort speichern"}
        </button>
      </div>
      {message && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{message}</p>}
      <p className="text-xs text-base-dark/50">Der Ort wird in den Vertrag eingetragen und ist danach in der Papier-Ansicht sowie im PDF sichtbar.</p>
    </div>
  );
}