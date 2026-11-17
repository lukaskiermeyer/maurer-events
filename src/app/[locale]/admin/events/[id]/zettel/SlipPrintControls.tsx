"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { markSlipsPrinted } from "@/app/actions/reservations";

export default function SlipPrintControls({ eventId, reservationIds }: { eventId: string; reservationIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const print = () => window.print();

  const markPrinted = async () => {
    setBusy(true);
    try {
      await markSlipsPrinted(eventId, reservationIds);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={print} className="min-h-12 inline-flex items-center gap-2 px-5 bg-base-dark text-white rounded-xl font-bold hover:bg-accent-green transition-colors">
        <Printer className="w-5 h-5" aria-hidden="true" />
        Drucken / PDF
      </button>
      <button type="button" onClick={markPrinted} disabled={busy || reservationIds.length === 0} className="min-h-12 inline-flex items-center px-5 bg-white border border-border-light rounded-xl font-bold hover:border-accent-green transition-colors disabled:opacity-50">
        {busy ? "Wird markiert…" : "Als gedruckt markieren"}
      </button>
    </div>
  );
}