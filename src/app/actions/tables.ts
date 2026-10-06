"use server";
import { db } from '@/db';
import { tables, reservations, eventSettings, settings } from '@/db/schema';
import { and, eq, isNotNull, isNull, or, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { activeReservation, dayRange, lockLayout } from '@/lib/reservation-db';
import { BookingError, calendarDate, uuid } from '@/lib/reservation-policy';

function integer(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) throw new BookingError('Ungültige Tischdaten.');
}
function refresh() { revalidatePath('/[locale]/admin', 'layout'); }
export async function getTables() { return db.select().from(tables); }
export async function createTable(data: { name: string; capacity: number; positionX?: number; positionY?: number }) {
  await requireAdmin();
  if (typeof data?.name !== 'string' || !data.name.trim() || data.name.length > 100) throw new BookingError('Ungültiger Tischname.');
  integer(data.capacity, 1, 100); integer(data.positionX ?? 0, 0, 10000); integer(data.positionY ?? 0, 0, 10000);
  await db.transaction(async tx => { await lockLayout(tx, true); await tx.insert(tables).values({ name: data.name.trim(), capacity: data.capacity, positionX: data.positionX ?? 0, positionY: data.positionY ?? 0 }); });
  refresh();
}
export async function deleteTable(id: string) {
  await requireAdmin(); uuid(id);
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    const [active] = await tx.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.tableId, id), activeReservation())).limit(1);
    if (active) throw new BookingError('Tisch kann nicht gelöscht werden, solange aktive Buchungen oder Zahlungsvorgänge existieren.');
    await tx.delete(tables).where(eq(tables.id, id));
    // Preserve names printed on existing tickets. Gaps are preferable to sending
    // guests to a different physical table after deleting an unrelated table.
  });
  refresh();
}
export async function updateTablePosition(id: string, x: number, y: number) {
  await requireAdmin(); uuid(id); integer(x, 0, 10000); integer(y, 0, 10000);
  await db.transaction(async tx => { await lockLayout(tx); await tx.update(tables).set({ positionX: x, positionY: y }).where(eq(tables.id, id)); }); refresh();
}
export async function toggleTableVip(id: string, isVip: boolean, vipPrice = 0) {
  await requireAdmin(); uuid(id); integer(vipPrice, 0, 99999999);
  if (typeof isVip !== 'boolean') throw new BookingError('Ungültige VIP-Einstellung.');
  await db.transaction(async tx => { await lockLayout(tx); await tx.update(tables).set({ isVip, vipPrice }).where(eq(tables.id, id)); }); refresh();
}
export async function getBookedTableIds(eventId: string, dateStr: string) {
  uuid(eventId); const day = calendarDate(dateStr);
  const [settings] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, eventId));
  const booked = await db.select({ tableId: reservations.tableId, guests: sum(reservations.guestCount).mapWith(Number), capacity: tables.capacity })
    .from(reservations).innerJoin(tables, eq(tables.id, reservations.tableId))
    .where(and(dayRange(day), activeReservation())).groupBy(reservations.tableId, tables.capacity);
  const exclusive = await db.selectDistinct({ tableId: reservations.tableId }).from(reservations)
    .leftJoin(eventSettings, eq(eventSettings.eventId, reservations.eventId))
    .where(and(dayRange(day), activeReservation(), isNotNull(reservations.tableId), or(eq(eventSettings.requireFullTable, true), isNull(eventSettings.id))));
  const exclusiveIds = new Set(exclusive.map(row => row.tableId));
  return booked.filter(row => (settings?.requireFullTable ?? true) || exclusiveIds.has(row.tableId) || row.guests >= row.capacity).map(row => row.tableId);
}
export async function generateTentLayout(tablesWidth: number, tablesLength: number, capacity: number) {
  await requireAdmin(); integer(tablesWidth, 1, 100); integer(tablesLength, 1, 100); integer(capacity, 1, 100);
  if (tablesWidth * tablesLength > 1000) throw new BookingError('Maximal 1000 Tische pro Layout.');
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    const [active] = await tx.select({ id: reservations.id }).from(reservations).where(and(isNotNull(reservations.tableId), activeReservation())).limit(1);
    if (active) throw new BookingError('Layout kann mit aktiven Tischbuchungen oder Zahlungsvorgängen nicht neu generiert werden.');
    await tx.delete(tables);
    const layout: typeof tables.$inferInsert[] = [];
    for (let y = 0; y < tablesLength; y++) for (let x = 0; x < tablesWidth; x++) layout.push({ name: `Tisch ${layout.length + 1}`, capacity,
      positionX: x < Math.floor(tablesWidth / 2) ? x : x + 1, positionY: y + Math.floor(y / 2) });
    await tx.insert(tables).values(layout);
    const value = JSON.stringify({ width: tablesWidth + 1, height: tablesLength + Math.floor(tablesLength / 2) });
    await tx.insert(settings).values({ key: 'tent_dimensions', value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
  refresh();
}
