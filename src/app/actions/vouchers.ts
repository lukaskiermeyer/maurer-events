"use server";

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { reservations, vouchers } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { redeemVoucher } from '@/lib/vouchers';
import { uuid } from '@/lib/reservation-policy';

export async function getVouchersForEvent(eventId: string) {
  await requireAdmin();
  uuid(eventId);
  return db.select({
    voucher: vouchers,
    guestName: reservations.guestName,
    reservationEmail: reservations.email,
  }).from(vouchers)
    .leftJoin(reservations, eq(vouchers.reservationId, reservations.id))
    .where(eq(vouchers.eventId, eventId))
    .orderBy(vouchers.createdAt);
}

export async function redeemVoucherAction(eventId: string, code: string) {
  try {
    const staff = await requireAdmin();
    uuid(eventId);
    const result = await redeemVoucher(db, { code, eventId, redeemedBy: staff.email });
    revalidatePath(`/[locale]/admin/events/${eventId}/gutscheine`, 'page');
    return { success: true, code: result.voucher.code, valueCents: result.voucher.valueCents };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Gutschein konnte nicht eingelöst werden.' };
  }
}