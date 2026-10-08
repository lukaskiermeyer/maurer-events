"use server";

import { db } from "@/db";
import { reservations, events, tables } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { reservationAdmin } from "@/lib/reservation-admin";
import { deliverTicket } from "@/lib/ticket-delivery";
import { requireAdmin, requireScanner } from "@/lib/auth";
import { scanForStaff } from '@/lib/staff-access';
import { uuid } from '@/lib/reservation-policy';

const service = reservationAdmin(db);

// Only select fields needed by the administration UI. Frozen checkout and
// email payloads, request hashes and retry keys never cross the client boundary.
const adminReservationColumns = {
  id: reservations.id, eventId: reservations.eventId, tableId: reservations.tableId,
  reservationDate: reservations.reservationDate, guestName: reservations.guestName,
  email: reservations.email, guestCount: reservations.guestCount, selectedTime: reservations.selectedTime,
  amountTotal: reservations.amountTotal, stripeSessionId: reservations.stripeSessionId,
  status: reservations.status, expiresAt: reservations.expiresAt, pdfUrl: reservations.pdfUrl,
  qrCodeText: reservations.qrCodeText, ticketSentAt: reservations.ticketSentAt,
  scannedAt: reservations.scannedAt, createdAt: reservations.createdAt, updatedAt: reservations.updatedAt,
};

export async function getReservations() {
  await requireAdmin();
  const results = await db.select({
    reservation: adminReservationColumns,
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

export async function assignTableToReservation(reservationId: string, tableId: string | null) {
  await requireAdmin();
  await service.assign(reservationId, tableId);
  const warning = await deliverTicket(reservationId);
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, warning };
}

export async function updateReservationStatus(reservationId: string, status: string) {
  await requireAdmin();
  try {
    await service.status(reservationId, status);
    const warning = status === 'confirmed' ? await deliverTicket(reservationId) : undefined;
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, warning };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Statuswechsel fehlgeschlagen.' };
  }
}

export async function createManualReservation(data: { eventId: string; guestName: string; email: string; guestCount: number; reservationDate: string; idempotencyKey: string }) {
  await requireAdmin();
  await service.manual(data);
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true };
}

export async function checkInGuestByQR(eventId: string, qrCodeText: string) {
  const staff = await requireScanner(eventId);
  try {
    const { reservation, tableName } = await scanForStaff(db, staff, qrCodeText, eventId);
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, guestName: reservation.guestName, guestCount: reservation.guestCount, tableName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Scan fehlgeschlagen.' };
  }
}

export async function getReservationsByEvent(eventId: string) {
  await requireAdmin(); uuid(eventId);
  const results = await db.select({
    reservation: adminReservationColumns,
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
