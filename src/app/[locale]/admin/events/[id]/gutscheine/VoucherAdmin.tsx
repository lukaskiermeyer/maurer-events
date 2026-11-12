"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import type { EventRecord, VoucherRecord } from "@/types/domain";
import { formatEuroCents } from "@/lib/pricing";
import { redeemVoucherAction } from "@/app/actions/vouchers";

type VoucherRow = {
  voucher: VoucherRecord;
  guestName: string | null;
  reservationEmail: string | null;
};

function statusLabel(status: string) {
  if (status === 'redeemed') return 'Eingelöst';
  if (status === 'void') return 'Ungültig';
  return 'Offen';
}

export default function VoucherAdmin({ event, vouchers }: { event: EventRecord; vouchers: VoucherRow[] }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const eventDate = new Date(event.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const issued = vouchers.filter(row => row.voucher.status === 'issued').length;
  const redeemed = vouchers.filter(row => row.voucher.status === 'redeemed').length;
  const voided = vouchers.filter(row => row.voucher.status === 'void').length;

  const redeem = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemVoucherAction(event.id, code);
      if (!result.success) {
        setMessage({ kind: "error", text: result.error || "Gutschein konnte nicht eingelöst werden." });
        return;
      }
      setMessage({ kind: "ok", text: `Gutschein ${result.code} über ${formatEuroCents(result.valueCents)} eingelöst.` });
      setCode("");
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{vouchers.length}</div><div className="text-xs uppercase font-bold opacity-50">Gesamt</div></div>
        <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{issued}</div><div className="text-xs uppercase font-bold opacity-50">Offen</div></div>
        <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{redeemed}</div><div className="text-xs uppercase font-bold opacity-50">Eingelöst</div></div>
        <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-amber-700">{voided}</div><div className="text-xs uppercase font-bold opacity-50">Ungültig</div></div>
      </div>

      <div className="no-print bg-white border border-border-light rounded-2xl p-5">
        <h2 className="font-display font-bold text-xl mb-3">Gutschein einlösen</h2>
        <form onSubmit={redeem} className="flex flex-col sm:flex-row gap-3">
          <input
            value={code}
            onChange={event => { setCode(event.target.value.toUpperCase()); setMessage(null); }}
            placeholder="ME-XXXXXXXXXX"
            className="flex-1 border border-border-light rounded-xl p-3 bg-base-light font-mono tracking-wider focus:outline-none focus:border-accent-green"
            maxLength={13}
          />
          <button type="submit" disabled={busy || !code.trim()} className="bg-accent-green text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-base-dark transition-colors">
            {busy ? "Wird geprüft…" : "Einlösen"}
          </button>
        </form>
        {message && (
          <p className={`mt-3 text-sm font-bold rounded-xl p-3 ${message.kind === "ok" ? "bg-accent-green/10 text-accent-green" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.text}
          </p>
        )}
        <p className="text-xs text-base-dark/60 mt-3">Gutscheine gelten ausschließlich für {event.title} am {eventDate} und können bei keinem anderen Event eingelöst werden.</p>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl">Gutscheine</h2>
          <p className="text-sm text-base-dark/60">{event.title} · {eventDate}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="bg-base-dark text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-accent-green transition-colors">Drucken / PDF</button>
          <Link href={`/admin/events/${event.id}`} className="bg-white border border-border-light px-5 py-2.5 rounded-lg font-bold text-sm hover:border-accent-green transition-colors">Zurück zum Event</Link>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <div className="bg-canvas-light border border-border-light rounded-2xl p-10 text-center text-base-dark/60">
          Noch keine Gutscheine. Sie werden automatisch bei bestätigten Online-Reservierungen mit Gutscheinpaket erzeugt.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vouchers.map(({ voucher, guestName }) => (
            <article key={voucher.id} className="voucher-card break-inside-avoid bg-white border border-border-light rounded-2xl overflow-hidden">
              <div className="bg-accent-green text-white px-5 py-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Maurer Events</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{statusLabel(voucher.status)}</span>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-1">Getränkegutschein</p>
                <p className="font-display font-black text-3xl text-base-dark mb-1">{formatEuroCents(voucher.valueCents)}</p>
                <p className="font-mono text-sm tracking-wider text-base-dark/70 mb-3">{voucher.code}</p>
                <p className="text-sm font-bold text-base-dark">{event.title}</p>
                <p className="text-sm text-base-dark/60">Nur am {eventDate} gültig</p>
                {guestName && <p className="text-xs text-base-dark/50 mt-2">Reservierung: {guestName}</p>}
              </div>
              <div className="h-1.5 bg-accent-gold" />
            </article>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          nav, header, footer, .no-print { display: none !important; }
          .voucher-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd !important; }
        }
      `}</style>
    </div>
  );
}