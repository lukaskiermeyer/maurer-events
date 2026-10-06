"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { lockLayout } from '@/lib/reservation-db';
import { BookingError } from '@/lib/reservation-policy';

export async function getTentSettings() {
  const result = await db.select().from(settings).where(eq(settings.key, "tent_dimensions"));
  if (result.length > 0) {
    return JSON.parse(result[0].value);
  }
  // Default to 10x8 if not set
  return { width: 10, height: 8 };
}

export async function saveTentSettings(width: number, height: number) {
  await requireAdmin();
  if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= 10000)) throw new BookingError('Ungültige Zeltdimensionen.');
  const value = JSON.stringify({ width, height });
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    await tx.insert(settings).values({ key: 'tent_dimensions', value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
}
