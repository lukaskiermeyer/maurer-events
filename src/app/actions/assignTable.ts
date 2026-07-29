"use server";

import { db } from "@/db";
import { reservations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function assignTable(reservationId: string, tableId: string | null) {
  try {
    await db.update(reservations)
      .set({ tableId })
      .where(eq(reservations.id, reservationId));
    
    revalidatePath("/admin/reservations");
    return { success: true };
  } catch (err: any) {
    console.error("Fehler beim Zuweisen des Tisches:", err);
    return { success: false, error: err.message };
  }
}
