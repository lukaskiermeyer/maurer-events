"use server";

import { db } from "@/db";
import { reservations, events, tables } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateTicketPdf } from "@/lib/ticket";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/auth";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export async function getReservations() {
  const results = await db.select({
    reservation: reservations,
    eventTitle: events.title,
    eventDate: events.date,
    tableName: tables.name
  })
      .from(reservations)
      .leftJoin(events, eq(reservations.eventId, events.id))
      .leftJoin(tables, eq(reservations.tableId, tables.id))
      .orderBy(desc(reservations.createdAt));

  return results;
}

export async function getReservationsByEvent(eventId: string) {
  const results = await db.select({
    reservation: reservations,
    eventTitle: events.title,
    eventDate: events.date,
    tableName: tables.name
  })
      .from(reservations)
      .leftJoin(events, eq(reservations.eventId, events.id))
      .leftJoin(tables, eq(reservations.tableId, tables.id))
      .where(eq(reservations.eventId, eventId))
      .orderBy(desc(reservations.createdAt));

  return results;
}

export async function assignTableToReservation(reservationId: string, tableId: string | null) {
  await requireAdmin();
  if (tableId) {
    const resList = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    const tableList = await db.select().from(tables).where(eq(tables.id, tableId));
    if (resList.length > 0 && tableList.length > 0) {
       if (resList[0].guestCount > tableList[0].capacity) {
          throw new Error(`Kapazität überschritten: Der Tisch hat nur Platz für ${tableList[0].capacity} Personen (Reservierung hat ${resList[0].guestCount} Personen).`);
       }
    }
  }
  await db.update(reservations).set({ tableId }).where(eq(reservations.id, reservationId));
  revalidatePath("/admin/reservations");
}

export async function updateReservationStatus(reservationId: string, status: string) {
  await requireAdmin();
  if (status === "confirmed") {
    // 1. Fetch reservation details
    const resList = await db.select({
      reservation: reservations,
      eventTitle: events.title,
      eventDate: events.date,
      tableName: tables.name
    })
        .from(reservations)
        .leftJoin(events, eq(reservations.eventId, events.id))
        .leftJoin(tables, eq(reservations.tableId, tables.id))
        .where(eq(reservations.id, reservationId));

    if (resList.length > 0) {
      const { reservation, eventTitle, eventDate, tableName } = resList[0];

      const qrCodeText = reservation.qrCodeText || reservation.id;

      // 2. Generate PDF
      const pdfBuffer = await generateTicketPdf({
        eventName: eventTitle || "Maurer Event",
        date: new Date(reservation.reservationDate).toLocaleDateString('de-DE'),
        guestName: reservation.guestName,
        guestCount: reservation.guestCount,
        tableName: tableName || "Kein Tisch zugewiesen",
        qrCodeText: qrCodeText
      });

      // 3. Send Email
      if (process.env.RESEND_API_KEY && reservation.email) {
        try {
          await resend.emails.send({
            from: "Maurer Events <servus@maurer-events.com>",
            to: [reservation.email],
            subject: `Dein Ticket für ${eventTitle}`,
            html: `<p>Hallo ${reservation.guestName},</p><p>Deine Reservierung wurde bestätigt! Im Anhang findest du dein offizielles Ticket inklusive QR-Code für den Einlass.</p><p>Wir freuen uns auf dich!</p>`,
            attachments: [
              {
                filename: 'ticket.pdf',
                content: pdfBuffer,
              }
            ]
          });
        } catch (error) {
          console.error("Failed to send ticket email for reservation", reservation.id, error);
          await db.update(reservations).set({ status, qrCodeText }).where(eq(reservations.id, reservationId));
          revalidatePath("/admin/reservations");
          revalidatePath(`/admin/events`);
          return { success: true, warning: "E-Mail konnte nicht gesendet werden." };
        }
      }

      // 4. Update DB
      await db.update(reservations).set({ status, qrCodeText }).where(eq(reservations.id, reservationId));
    }
  } else {
    await db.update(reservations).set({ status }).where(eq(reservations.id, reservationId));
  }

  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/events`);
  return { success: true };
}

export async function createManualReservation(data: {
  eventId: string;
  guestName: string;
  email: string;
  guestCount: number;
  reservationDate: string;
}) {
  await requireAdmin();
  await db.insert(reservations).values({
    eventId: data.eventId,
    guestName: data.guestName,
    email: data.email,
    guestCount: data.guestCount,
    reservationDate: new Date(data.reservationDate),
    status: "paid", // Manual reservations are marked as paid directly
    amountTotal: 0, // Admin override
  });
  revalidatePath("/admin/reservations");
}

export async function checkInGuestByQR(eventId: string, qrCodeText: string) {
  await requireAdmin();
  // Find reservation by QR code (or ID as fallback, since qrCodeText might just be the ID in older versions)
  // Also ensure it belongs to the correct event
  const [reservation] = await db.select()
      .from(reservations)
      .where(
          and(
              eq(reservations.eventId, eventId),
              eq(reservations.qrCodeText, qrCodeText)
          )
      );

  if (!reservation) {
    // Check if qrCodeText is a valid UUID before trying fallback, otherwise db throws an error
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrCodeText);

    if (!isUuid) {
      return { success: false, error: "Ticket nicht gefunden für dieses Event. (Ungültiger Code)" };
    }

    // Try by ID fallback just in case
    const [fallbackRes] = await db.select()
        .from(reservations)
        .where(
            and(
                eq(reservations.eventId, eventId),
                eq(reservations.id, qrCodeText)
            )
        );

    if (!fallbackRes) {
      return { success: false, error: "Ticket nicht gefunden für dieses Event." };
    }

    return processCheckIn(fallbackRes);
  }

  return processCheckIn(reservation);
}

async function processCheckIn(reservation: any) {
  if (reservation.status !== "paid" && reservation.status !== "confirmed") {
    return { success: false, error: `Ticket ist nicht gültig. Status: ${reservation.status}` };
  }

  if (reservation.scannedAt) {
    const time = new Date(reservation.scannedAt).toLocaleTimeString('de-DE');
    return { success: false, error: `Bereits gescannt um ${time} Uhr!` };
  }

  // Mark as scanned
  await db.update(reservations)
      .set({ scannedAt: new Date() })
      .where(eq(reservations.id, reservation.id));

  revalidatePath(`/admin/events/${reservation.eventId}`);
  revalidatePath("/admin/reservations");

  let tableName = "Kein Tisch";
  if (reservation.tableId) {
    const [table] = await db.select().from(tables).where(eq(tables.id, reservation.tableId));
    if (table) tableName = table.name;
  }

  return {
    success: true,
    guestName: reservation.guestName,
    guestCount: reservation.guestCount,
    tableName
  };
}