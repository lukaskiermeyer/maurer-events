import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, planPresets, tables } from "@/db/schema";
import { findTable, tableLabel } from "@/lib/plan-types";

type Connection = typeof db;

// Tischname einer Reservierung: Plan-Preset (planTableId) hat Vorrang vor der
// alten tables-Tabelle (tableId). Ohne Zuweisung null → Aufrufer entscheidet
// über die Anzeige ("Freie Platzwahl" bzw. "wird vor Ort zugewiesen").
export async function resolveTableName(
  reservation: { eventId: string; tableId: string | null; planTableId: string | null },
  connection: Connection = db,
): Promise<string | null> {
  if (reservation.planTableId) {
    const [ev] = await connection.select({ planPresetId: events.planPresetId }).from(events).where(eq(events.id, reservation.eventId));
    if (ev?.planPresetId) {
      const [preset] = await connection.select({ layout: planPresets.layout }).from(planPresets).where(eq(planPresets.id, ev.planPresetId));
      const table = preset ? findTable(preset.layout, reservation.planTableId) : undefined;
      if (table) return tableLabel(preset.layout, table) + (table.rowLabel ? ` · ${table.rowLabel}` : "");
    }
  }
  if (reservation.tableId) {
    const [table] = await connection.select({ name: tables.name, displayNumber: tables.displayNumber }).from(tables).where(eq(tables.id, reservation.tableId));
    if (table) return table.displayNumber || table.name;
  }
  return null;
}