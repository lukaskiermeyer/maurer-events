"use server";

import { db } from "@/db";
import { reservations, events, tables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function scanTicket(qrCodeText: string) {
  try {
    const resList = await db.select({
      reservation: reservations,
      eventTitle: events.title,
      tableName: tables.name
    })
    .from(reservations)
    .leftJoin(events, eq(reservations.eventId, events.id))
    .leftJoin(tables, eq(reservations.tableId, tables.id))
    .where(eq(reservations.qrCodeText, qrCodeText));

    if (resList.length === 0) {
      return { success: false, error: "Ticket nicht gefunden (Ungültiger Code)." };
    }

    const { reservation, eventTitle, tableName } = resList[0];

    if (reservation.status !== "confirmed") {
      return { success: false, error: `Ticket ungültig! Status ist: ${reservation.status}.` };
    }

    if (reservation.scannedAt !== null) {
      const scannedDate = new Date(reservation.scannedAt).toLocaleTimeString("de-DE");
      return { success: false, error: `ACHTUNG: Ticket wurde bereits um ${scannedDate} Uhr gescannt!` };
    }

    // Mark as scanned
    await db.update(reservations).set({ scannedAt: new Date() }).where(eq(reservations.id, reservation.id));
    revalidatePath("/admin/scan");
    revalidatePath(`/admin/events/${reservation.eventId}`);

    return { 
      success: true, 
      message: "Ticket erfolgreich entwertet!",
      data: {
        guestName: reservation.guestName,
        guestCount: reservation.guestCount,
        tableName: tableName || "Kein Tisch",
        eventTitle: eventTitle
      }
    };

  } catch (error) {
    console.error("Fehler beim Scannen:", error);
    return { success: false, error: "Systemfehler beim Scannen." };
  }
}
