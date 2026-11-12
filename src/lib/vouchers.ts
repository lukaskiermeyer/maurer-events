import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eventSettings, events, reservations, vouchers } from '@/db/schema';
import { lockLayout, type BookingTx } from './reservation-db';
import { BookingError, uuid } from './reservation-policy';

export function voucherCode() {
  return `ME-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

export async function issueVouchersForReservation(
  tx: BookingTx,
  event: typeof events.$inferSelect,
  reservation: typeof reservations.$inferSelect,
) {
  if (reservation.source !== 'online' || reservation.status !== 'confirmed') return [];
  const [settingsRow] = await tx.select().from(eventSettings).where(eq(eventSettings.eventId, event.id));
  const pkg = settingsRow?.packages?.find(entry => entry.id === reservation.packageId);
  if (!pkg || pkg.type !== 'voucher_bundle') return [];

  const existing = await tx.select().from(vouchers).where(eq(vouchers.reservationId, reservation.id));
  if (existing.length > 0) return existing;

  const count = Math.min(1000, Math.max(1, pkg.voucherCount ?? 0));
  const valueCents = pkg.voucherValueCents ?? 0;
  if (!pkg.voucherCount || valueCents <= 0) throw new BookingError('Gutscheinpaket ist unvollständig konfiguriert.');
  const rows = Array.from({ length: count }, () => ({
    eventId: event.id,
    reservationId: reservation.id,
    code: voucherCode(),
    valueCents,
    status: 'issued',
    note: pkg.voucherTerms || null,
  }));
  return tx.insert(vouchers).values(rows).returning();
}

export async function voidVouchersForReservation(tx: BookingTx, reservationId: string) {
  return tx.update(vouchers).set({ status: 'void' }).where(and(eq(vouchers.reservationId, reservationId), eq(vouchers.status, 'issued'))).returning();
}

export async function redeemVoucher(connection: typeof db, input: { code: string; eventId: string; redeemedBy: string }) {
  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  if (!/^ME-[A-Z0-9]{10}$/.test(code)) throw new BookingError('Ungültiger Gutschein-Code.');
  const eventId = uuid(input.eventId);
  return connection.transaction(async tx => {
    await lockLayout(tx);
    const [voucher] = await tx.select().from(vouchers).where(eq(vouchers.code, code)).for('update');
    if (!voucher) throw new BookingError('Gutschein nicht gefunden.', 404);
    if (voucher.eventId !== eventId) throw new BookingError('Dieser Gutschein gehört zu einem anderen Event und kann hier nicht eingelöst werden.', 409);
    if (voucher.status === 'redeemed') throw new BookingError('Dieser Gutschein wurde bereits eingelöst.', 409);
    if (voucher.status === 'void') throw new BookingError('Dieser Gutschein ist ungültig.', 409);
    const [updated] = await tx.update(vouchers).set({
      status: 'redeemed',
      redeemedAt: new Date(),
      redeemedBy: input.redeemedBy,
    }).where(eq(vouchers.id, voucher.id)).returning();
    const [event] = await tx.select().from(events).where(eq(events.id, eventId));
    return { voucher: updated, event };
  });
}