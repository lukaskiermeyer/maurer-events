"use server";

import { db } from "@/db";
import { reservations, events, tables, customers } from "@/db/schema";
import { eq, desc, and, inArray, isNull } from "drizzle-orm";
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
  id: reservations.id, eventId: reservations.eventId, customerId: reservations.customerId, tableId: reservations.tableId, planTableId: reservations.planTableId,
  reservationDate: reservations.reservationDate, guestName: reservations.guestName,
  email: reservations.email, phone: reservations.phone, guestCount: reservations.guestCount, selectedTime: reservations.selectedTime,
  amountTotal: reservations.amountTotal, stripeSessionId: reservations.stripeSessionId,
  status: reservations.status, source: reservations.source, groupLabel: reservations.groupLabel,
  groupIndex: reservations.groupIndex, groupSize: reservations.groupSize,
  notes: reservations.notes, internalNotes: reservations.internalNotes,
  packageId: reservations.packageId, packageName: reservations.packageName,
  agreedPriceCents: reservations.agreedPriceCents,
  confirmedAt: reservations.confirmedAt, confirmedBy: reservations.confirmedBy,
  slipPrintedAt: reservations.slipPrintedAt, paymentStatus: reservations.paymentStatus,
  expiresAt: reservations.expiresAt, pdfUrl: reservations.pdfUrl,
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

export async function markSlipsPrinted(eventId: string, reservationIds: string[]) {
  await requireAdmin();
  uuid(eventId);
  if (!Array.isArray(reservationIds) || reservationIds.length > 500) throw new Error('Ungültige Zettel-Auswahl.');
  reservationIds.forEach(id => uuid(id));
  if (reservationIds.length === 0) return { success: true };
  await db.update(reservations).set({ slipPrintedAt: new Date() }).where(and(
    eq(reservations.eventId, eventId),
    inArray(reservations.id, reservationIds),
    inArray(reservations.status, ['paid', 'confirmed']),
  ));
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true };
}

// Reservierung festschreiben (confirmed) und optional Bestätigungs-Mail senden.
// Ohne Mail (oder bei Versandfehler) bleibt ticketSentAt null → Warnsignal + ToDo.
export async function finalizeReservation(reservationId: string, sendEmail = true) {
  await requireAdmin();
  uuid(reservationId);
  await service.status(reservationId, 'confirmed');
  const warning = sendEmail ? await deliverTicket(reservationId) : undefined;
  const [row] = await db.select({ ticketSentAt: reservations.ticketSentAt }).from(reservations).where(eq(reservations.id, reservationId));
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, warning, mailSent: Boolean(row?.ticketSentAt) };
}

export async function sendConfirmationMail(reservationId: string) {
  await requireAdmin();
  uuid(reservationId);
  const warning = await deliverTicket(reservationId);
  const [row] = await db.select({ ticketSentAt: reservations.ticketSentAt }).from(reservations).where(eq(reservations.id, reservationId));
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, warning, mailSent: Boolean(row?.ticketSentAt) };
}

// Ticket-PDF + Mail neu erzeugen (z. B. nach Tisch-Korrektur): eingefrorene Mail
// verwerfen und erneut senden. Der QR-Code bleibt gültig, damit bereits
// gedruckte Tickets weiter funktionieren.
export async function reissueTicket(reservationId: string) {
  await requireAdmin();
  uuid(reservationId);
  await db.update(reservations).set({ ticketEmailPayload: null, ticketSentAt: null, updatedAt: new Date() }).where(eq(reservations.id, reservationId));
  const warning = await deliverTicket(reservationId);
  const [row] = await db.select({ ticketSentAt: reservations.ticketSentAt }).from(reservations).where(eq(reservations.id, reservationId));
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, warning, mailSent: Boolean(row?.ticketSentAt) };
}

// Offene ToDos: festgeschriebene Reservierungen, deren Bestätigungs-Mail noch nicht raus ist.
export async function getOpenMailTodos() {
  await requireAdmin();
  const rows = await db.select({
    id: reservations.id,
    guestName: reservations.guestName,
    email: reservations.email,
    guestCount: reservations.guestCount,
    reservationDate: reservations.reservationDate,
    eventId: reservations.eventId,
    eventTitle: events.title,
  })
    .from(reservations)
    .leftJoin(events, eq(reservations.eventId, events.id))
    .where(and(eq(reservations.status, 'confirmed'), isNull(reservations.ticketSentAt)))
    .orderBy(desc(reservations.createdAt))
    .limit(100);
  return rows;
}

// Kunde direkt aus dem Plan-Panel einer Tisch-Reservierung zuordnen:
// manuelle Buchung anlegen und optional sofort auf einen Plan-Tisch setzen.
export async function createReservationForCustomer(data: { eventId: string; customerId: string; guestCount: number; reservationDate: string; planTableId?: string | null }) {
  await requireAdmin();
  uuid(data.eventId);
  uuid(data.customerId);
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, data.customerId), isNull(customers.deletedAt)));
  if (!customer) throw new Error('Kunde nicht gefunden.');
  if (!customer.email || !customer.email.trim()) throw new Error('Kunde hat keine E-Mail-Adresse – Reservierung ohne Mail nicht möglich.');
  const id = crypto.randomUUID();
  await service.manual({
    eventId: data.eventId,
    guestName: customer.displayName,
    email: customer.email,
    guestCount: data.guestCount,
    reservationDate: data.reservationDate,
    idempotencyKey: id,
  });
  if (data.planTableId) {
    const { assignPlanTable } = await import("./plans");
    await assignPlanTable(id, data.planTableId);
  }
  revalidatePath('/[locale]/admin', 'layout');
  return { success: true, reservationId: id };
}
