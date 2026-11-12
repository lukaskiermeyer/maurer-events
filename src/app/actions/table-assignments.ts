"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customers, reservations, tables } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assertCapacity, lockEvent, lockLayout } from "@/lib/reservation-db";
import { assertEventDay, BookingError, calendarDate, guestDetails, uuid } from "@/lib/reservation-policy";
import { toCalendarDay } from "@/lib/date";
import { issueVouchersForReservation } from "@/lib/vouchers";
import { deliverTicket } from "@/lib/ticket-delivery";

/**
 * Direct Tisch-Zuweisung: Kunde + Tisch + Event → bestätigte Reservierung mit
 * automatischer Ticket-Mail (PDF enthält Tischname + QR-Code).
 * Online-Reservierungen bleiben unberührt (Zukunft).
 */
export async function assignTableToCustomer(data: {
  customerId: string;
  eventId: string;
  reservationDate: string;
  tableId: string;
  guestCount: number;
  idempotencyKey?: string;
  sendEmail?: boolean;
}) {
  const actor = await requireAdmin();
  const customerId = uuid(data?.customerId, "Kunde");
  const eventId = uuid(data?.eventId);
  const tableId = uuid(data?.tableId, "Tisch");
  const idempotencyKey = data?.idempotencyKey ? uuid(data.idempotencyKey, "Buchungs-ID") : randomUUID();
  const day = calendarDate(data?.reservationDate);

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!customer || customer.deletedAt) throw new BookingError("Kunde nicht gefunden.", 404);
  if (!customer.email?.trim()) throw new BookingError("Für diesen Kunden ist keine E-Mail hinterlegt. Bitte zuerst die E-Mail im Kundenprofil ergänzen.");
  const guestName = customer.displayName?.trim();
  if (!guestName) throw new BookingError("Kundenname fehlt.");
  const details = guestDetails(guestName, customer.email, Number(data?.guestCount));

  const reservation = await db.transaction(async tx => {
    await lockLayout(tx);
    const event = await lockEvent(tx, eventId);
    assertEventDay(event, day);
    const [existing] = await tx.select().from(reservations).where(eq(reservations.id, idempotencyKey));
    if (existing) {
      if (existing.eventId !== eventId || existing.customerId !== customerId || existing.tableId !== tableId) {
        throw new BookingError("Zuweisungsschlüssel bereits anderweitig verwendet.", 409);
      }
      return existing;
    }
    await assertCapacity(tx, event, day, details.guestCount, tableId, undefined);
    const [created] = await tx.insert(reservations).values({
      id: idempotencyKey,
      eventId,
      customerId,
      tableId,
      reservationDate: day,
      guestName: details.guestName,
      email: details.email,
      guestCount: details.guestCount,
      status: "confirmed",
      source: "manual",
      paymentStatus: "paid",
      amountTotal: 0,
      qrCodeText: randomUUID(),
      confirmedAt: new Date(),
      confirmedBy: actor.email,
    }).returning();
    await issueVouchersForReservation(tx, event, created);
    return created;
  });

  const warning = data?.sendEmail === false ? undefined : await deliverTicket(reservation.id);
  revalidatePath("/[locale]/admin", "layout");
  const [table] = await db.select({ name: tables.name, displayNumber: tables.displayNumber }).from(tables).where(eq(tables.id, tableId));
  return {
    success: true,
    reservationId: reservation.id,
    tableName: table?.displayNumber || table?.name || tableId,
    sentAt: toCalendarDay(reservation.reservationDate).toISOString(),
    warning,
  };
}
