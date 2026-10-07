"use server";
import { db } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { grantScannerAccess, revokeScannerAccess } from '@/lib/staff-access';
import { revalidatePath } from 'next/cache';

export async function saveScannerAccess(input: { eventId: string; email: string; validUntil: string }) {
  const actor = await requireAdmin();
  try {
    await grantScannerAccess(db, actor, input);
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Zugang konnte nicht gespeichert werden.' }; }
}
export async function removeScannerAccess(eventId: string, accessId: string) {
  const actor = await requireAdmin();
  await revokeScannerAccess(db, actor, eventId, accessId);
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true };
}
