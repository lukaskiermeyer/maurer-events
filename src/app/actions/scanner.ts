"use server";
import { db } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { reservationAdmin } from '@/lib/reservation-admin';
import { revalidatePath } from 'next/cache';

export async function scanTicket(qrCodeText: string) {
  await requireAdmin();
  try {
    const { reservation, tableName, eventTitle } = await reservationAdmin(db).scan(qrCodeText);
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, message: 'Ticket erfolgreich entwertet!', data: { guestName: reservation.guestName, guestCount: reservation.guestCount, tableName, eventTitle } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Systemfehler beim Scannen.' };
  }
}
