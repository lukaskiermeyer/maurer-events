"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReservationRow, TableRecord } from "@/types/domain";
import { confirmReservationRequest, declineReservationRequest } from "@/app/actions/reservationRequests";
import { useToast } from "@/components/ui/Toast";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function RequestCard({ row, tables }: { row: ReservationRow; tables: TableRecord[] }) {
  const request = row.reservation;
  const toast = useToast();
  const router = useRouter();
  const [tableId, setTableId] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const priceCents = price.trim() ? Math.round(Number(price.replace(",", ".")) * 100) : null;
      if (priceCents !== null && (!Number.isFinite(priceCents) || priceCents < 0)) {
        toast.showToast("Bitte einen gültigen Preis eingeben.", "warning");
        return;
      }
      const result = await confirmReservationRequest(request.id, {
        tableId: tableId || null,
        priceCents,
      });
      if (!result.success) {
        toast.showToast(result.error || "Anfrage konnte nicht bestätigt werden.", "error");
        return;
      }
      if (result.warning) toast.showToast(result.warning, "warning");
      toast.showToast("Anfrage bestätigt. E-Mail wird gesendet.", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    const reason = prompt("Grund für die Ablehnung (optional, wird an den Gast gesendet):");
    if (reason === null) return;
    setBusy(true);
    try {
      const result = await declineReservationRequest(request.id, reason);
      if (!result.success) {
        toast.showToast(result.error || "Anfrage konnte nicht abgelehnt werden.", "error");
        return;
      }
      if (result.warning) toast.showToast(result.warning, "warning");
      toast.showToast("Anfrage abgelehnt.", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-white border border-border-light rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-xl break-words">{request.guestName}</h3>
          {request.groupLabel && <p className="text-sm font-bold text-accent-green break-words">{request.groupLabel}</p>}
          <p className="text-sm text-base-dark/60 break-all">{request.email}{request.phone ? ` · ${request.phone}` : ""}</p>
        </div>
        <span className="inline-flex self-start bg-amber-100 text-amber-900 border border-amber-200 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest">
          Offen
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <div><dt className="text-xs uppercase tracking-wider text-base-dark/50 font-bold">Datum</dt><dd className="font-bold">{formatDate(request.reservationDate)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-base-dark/50 font-bold">Personen</dt><dd className="font-bold">{request.guestCount}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-base-dark/50 font-bold">Tische</dt><dd className="font-bold">{request.groupSize || 1}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-base-dark/50 font-bold">Uhrzeit</dt><dd className="font-bold">{request.selectedTime || "offen"}</dd></div>
      </dl>

      {request.notes && (
        <p className="text-sm bg-canvas-light border border-border-light rounded-xl p-3 mb-4 whitespace-pre-wrap break-words">{request.notes}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor={`table-${request.id}`} className="block text-xs font-bold uppercase tracking-wider text-base-dark/60 mb-1">Tisch zuweisen</label>
          <select
            id={`table-${request.id}`}
            value={tableId}
            onChange={event => setTableId(event.target.value)}
            disabled={busy}
            className="w-full min-h-11 border border-border-light rounded-lg bg-base-light px-3 text-sm"
          >
            <option value="">Ohne Tisch bestätigen</option>
            {tables.map(table => (
              <option key={table.id} value={table.id}>{table.name} · {table.capacity} Plätze</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`price-${request.id}`} className="block text-xs font-bold uppercase tracking-wider text-base-dark/60 mb-1">Preis pro Tisch (€, optional)</label>
          <input
            id={`price-${request.id}`}
            inputMode="decimal"
            value={price}
            onChange={event => setPrice(event.target.value)}
            disabled={busy}
            className="w-full min-h-11 border border-border-light rounded-lg bg-base-light px-3 text-sm"
            placeholder="z.B. 120,00"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="bg-accent-green text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-base-dark transition-colors disabled:opacity-50"
        >
          {busy ? "Wird gespeichert…" : "Bestätigen & Mail senden"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={busy}
          className="bg-white border border-red-200 text-red-700 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Ablehnen
        </button>
      </div>
    </article>
  );
}

export default function ReservationRequestsPanel({ requests, tables }: { requests: ReservationRow[]; tables: TableRecord[] }) {
  const open = requests.filter(row => row.reservation.status === "requested");

  if (open.length === 0) {
    return (
      <div className="text-center py-12 bg-canvas-light rounded-2xl border border-border-light">
        <p className="font-bold text-lg">Keine offenen Anfragen</p>
        <p className="text-sm text-base-dark/60 mt-1">Neue E-Mail-Anfragen erscheinen hier automatisch.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold text-2xl">Offene Anfragen ({open.length})</h2>
        <p className="text-sm text-base-dark/60">Bestätigen sendet automatisch eine E-Mail an den Gast.</p>
      </div>
      {open.map(row => <RequestCard key={row.reservation.id} row={row} tables={tables} />)}
    </div>
  );
}