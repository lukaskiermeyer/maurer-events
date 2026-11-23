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
function text(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 100) throw new BookingError(`Ungültige ${label}.`);
  return value.trim() || null;
}
function dimension(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000) throw new BookingError(`Ungültige ${label}.`);
  return value;
}
function tableMeta(data: { section?: string | null; rowLabel?: string | null; displayNumber?: string | null; shape?: 'rect' | 'round'; widthM?: number | null; heightM?: number | null; rotation?: number; isBlocked?: boolean }) {
  const section = text(data.section, 'Sektion');
  const rowLabel = text(data.rowLabel, 'Reihe');
  const displayNumber = text(data.displayNumber, 'Tischnummer');
  const widthM = dimension(data.widthM, 'Tischbreite');
  const heightM = dimension(data.heightM, 'Tischhöhe');
  if (data.shape !== undefined && data.shape !== 'rect' && data.shape !== 'round') throw new BookingError('Ungültige Tischform.');
  if (data.rotation !== undefined) integer(data.rotation, 0, 359);
  if (data.isBlocked !== undefined && typeof data.isBlocked !== 'boolean') throw new BookingError('Ungültiger Tischstatus.');
  return {
    ...(section !== undefined ? { section } : {}),
    ...(rowLabel !== undefined ? { rowLabel } : {}),
    ...(displayNumber !== undefined ? { displayNumber } : {}),
    ...(widthM !== undefined ? { widthM } : {}),
    ...(heightM !== undefined ? { heightM } : {}),
    ...(data.shape !== undefined ? { shape: data.shape } : {}),
    ...(data.rotation !== undefined ? { rotation: data.rotation } : {}),
    ...(data.isBlocked !== undefined ? { isBlocked: data.isBlocked } : {}),
  };
}
export async function getTables() { return db.select().from(tables); }
export async function createTable(data: { name: string; capacity: number; positionX?: number; positionY?: number; section?: string | null; rowLabel?: string | null; displayNumber?: string | null; shape?: 'rect' | 'round'; widthM?: number | null; heightM?: number | null; rotation?: number; isBlocked?: boolean }) {
  await requireAdmin();
  if (typeof data?.name !== 'string' || !data.name.trim() || data.name.length > 100) throw new BookingError('Ungültiger Tischname.');
  integer(data.capacity, 1, 100); integer(data.positionX ?? 0, 0, 10000); integer(data.positionY ?? 0, 0, 10000);
  const meta = tableMeta(data);
  await db.transaction(async tx => { await lockLayout(tx, true); await tx.insert(tables).values({ name: data.name.trim(), capacity: data.capacity, positionX: data.positionX ?? 0, positionY: data.positionY ?? 0, ...meta }); });
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
export async function updateTableMeta(id: string, data: { section?: string | null; rowLabel?: string | null; displayNumber?: string | null; shape?: 'rect' | 'round'; widthM?: number | null; heightM?: number | null; rotation?: number; isBlocked?: boolean }) {
  await requireAdmin(); uuid(id);
  const meta = tableMeta(data);
  if (Object.keys(meta).length === 0) return;
  await db.transaction(async tx => { await lockLayout(tx); await tx.update(tables).set(meta).where(eq(tables.id, id)); });
  refresh();
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
    .where(and(eq(reservations.eventId, eventId), dayRange(day), activeReservation())).groupBy(reservations.tableId, tables.capacity);
  const exclusive = await db.selectDistinct({ tableId: reservations.tableId }).from(reservations)
    .leftJoin(eventSettings, eq(eventSettings.eventId, reservations.eventId))
    .where(and(eq(reservations.eventId, eventId), dayRange(day), activeReservation(), isNotNull(reservations.tableId), or(eq(eventSettings.requireFullTable, true), isNull(eventSettings.id))));
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
    for (let y = 0; y < tablesLength; y++) for (let x = 0; x < tablesWidth; x++) {
      const section = x < Math.floor(tablesWidth / 2) ? 'Links' : x === Math.floor(tablesWidth / 2) ? 'Mittelschiff' : 'Rechts';
      const number = layout.length + 1;
      layout.push({
        name: `Tisch ${number}`,
        capacity,
        positionX: x < Math.floor(tablesWidth / 2) ? x : x + 1,
        positionY: y + Math.floor(y / 2),
        section,
        rowLabel: String(y + 1),
        displayNumber: `T${String(number).padStart(3, '0')}`,
      });
    }
    await tx.insert(tables).values(layout);
    const value = JSON.stringify({ width: tablesWidth + 1, height: tablesLength + Math.floor(tablesLength / 2), cellSizeM: 1.2 });
    await tx.insert(settings).values({ key: 'tent_dimensions', value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
  refresh();
}
