import Image from "next/image";
import type { ReservationRow, TableRecord } from "@/types/domain";

function displayName(row: ReservationRow, mode: "full" | "initial" | "club") {
  const reservation = row.reservation;
  if (mode === "club") return reservation.groupLabel || reservation.guestName;
  if (mode === "initial") {
    const parts = reservation.guestName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return reservation.guestName;
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return reservation.guestName;
}

function shortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function SlipCard({
  row,
  table,
  nameMode,
  note,
  format,
  eventTitle,
}: {
  row: ReservationRow;
  table: TableRecord;
  nameMode: "full" | "initial" | "club";
  note: string;
  format: "a6" | "a5";
  eventTitle: string;
}) {
  const reservation = row.reservation;
  const compact = format === "a6";
  const section = table.section || "Zelt";
  const rowLabel = table.rowLabel || String(table.positionY + 1);
  const tableNumber = table.displayNumber || table.name;
  const name = displayName(row, nameMode);

  return (
    <article
      className={`slip-card ${compact ? "slip-a6 p-3" : "slip-a5 p-5"} bg-canvas-light border border-border-light flex flex-col overflow-hidden`}
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <div className={`bg-accent-green text-white flex items-center justify-between gap-2 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        <Image src="/LogoFinalGrün_MaurerEvents.svg" alt="Maurer Events" width={162} height={76} className={`${compact ? "h-5" : "h-7"} w-auto object-contain brightness-0 invert`} />
        <span className={`${compact ? "text-[7px]" : "text-[9px]"} font-bold uppercase tracking-[0.18em]`}>Reserviert</span>
      </div>

      <div className={`flex-1 flex flex-col ${compact ? "pt-2" : "pt-3"}`}>
        <p className={`${compact ? "text-[9px]" : "text-xs"} font-bold uppercase tracking-[0.2em] text-accent-wood mb-1`}>Reserviert</p>
        <p className={`${compact ? "text-[7px] leading-snug" : "text-[10px] leading-snug"} text-base-dark/70 mb-2`}>{note}</p>
        <p className={`${compact ? "text-[7px]" : "text-[10px]"} font-mono tracking-wide text-base-dark/70 mb-2`}>
          #{reservation.id.slice(0, 8)} · {section} · Reihe {rowLabel} · {tableNumber}
        </p>
        <p className={`${compact ? "text-base" : "text-2xl"} font-display font-black text-base-dark leading-tight break-words`}>{name}</p>
        {reservation.groupLabel && nameMode !== "club" && (
          <p className={`${compact ? "text-[8px]" : "text-xs"} font-bold text-accent-green break-words`}>{reservation.groupLabel}</p>
        )}
        <div className={`mt-auto grid grid-cols-3 gap-2 ${compact ? "pt-2" : "pt-4"} border-t border-border-light`}>
          <div><p className={`${compact ? "text-[6px]" : "text-[9px]"} uppercase font-bold text-base-dark/50`}>Datum</p><p className={`${compact ? "text-[8px]" : "text-xs"} font-bold`}>{shortDate(reservation.reservationDate)}</p></div>
          <div><p className={`${compact ? "text-[6px]" : "text-[9px]"} uppercase font-bold text-base-dark/50`}>Personen</p><p className={`${compact ? "text-[8px]" : "text-xs"} font-bold`}>{reservation.guestCount}</p></div>
          <div><p className={`${compact ? "text-[6px]" : "text-[9px]"} uppercase font-bold text-base-dark/50`}>Uhrzeit</p><p className={`${compact ? "text-[8px]" : "text-xs"} font-bold`}>{reservation.selectedTime || "—"}</p></div>
        </div>
        <p className={`${compact ? "text-[6px] mt-1" : "text-[9px] mt-2"} text-base-dark/50`}>{eventTitle}</p>
      </div>
      <div className="h-1.5 bg-accent-gold mt-2" />
    </article>
  );
}