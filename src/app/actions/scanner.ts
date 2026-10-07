"use server";
import { db } from '@/db';
import { requireScanner } from '@/lib/auth';
import { scanForStaff } from '@/lib/staff-access';
import { revalidatePath } from 'next/cache';

export async function scanTicket(qrCodeText: string) {
  const staff = await requireScanner();
  try {
    const { reservation, tableName, eventTitle } = await scanForStaff(db, staff, qrCodeText);
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, message: 'Ticket erfolgreich entwertet!', data: { guestName: reservation.guestName, guestCount: reservation.guestCount, tableName, eventTitle } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Systemfehler beim Scannen.' };
  }
}
