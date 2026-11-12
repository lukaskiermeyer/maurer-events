"use server";

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { events, reservations, tables } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { BookingError, calendarDate, cleanTime, guestDetails, uuid } from '@/lib/reservation-policy';
import { verifyTurnstile } from '@/lib/turnstile';
import { takeRateLimit } from '@/lib/rate-limit';
import { lockEvent, lockLayout } from '@/lib/reservation-db';
import { reservationAdmin } from '@/lib/reservation-admin';
import { ensureCustomerForReservation, linkReservationCustomer } from '@/lib/customers';
import {
  sendReservationConfirmation,
  sendReservationDecline,
  sendReservationRequestEmails,
} from '@/lib/reservation-request-email';

const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '2026-11';

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new BookingError(`Ungültige ${label}.`);
  }
  return value.trim() || null;
}

function emailData(event: typeof events.$inferSelect, reservation: typeof reservations.$inferSelect) {
  return {
    id: reservation.id,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date,
    eventLocation: event.location,
    guestName: reservation.guestName,
    email: reservation.email,
    phone: reservation.phone,
    club: reservation.groupLabel,
    guestCount: reservation.guestCount,
    tables: reservation.groupSize,
    time: reservation.selectedTime,
    message: reservation.notes,
    reservationEmail: event.reservationEmail,
  };
}

export async function submitReservationRequest(data: {
  eventId: string;
  name: string;
  email: string;
  phone?: string;
  club?: string;
  reservationDate: string;
  time?: string;
  guestCount: number;
  tables?: number;
  message?: string;
  privacy: boolean;
  turnstileToken: string;
  idempotencyKey?: string;
}) {
  try {
    const eventId = uuid(data?.eventId);
    const details = guestDetails(data?.name, data?.email, data?.guestCount);
    const day = calendarDate(data?.reservationDate);
    const time = data?.time ? cleanTime(data.time) : null;
    const tablesRequested = data?.tables === undefined ? 1 : Number(data.tables);
    if (!Number.isInteger(tablesRequested) || tablesRequested < 1 || tablesRequested > 50) {
      throw new BookingError('Ungültige Tischanzahl.');
    }
    const phone = optionalText(data?.phone, 50, 'Telefonnummer');
    const club = optionalText(data?.club, 150, 'Vereins- oder Firmenname');
    const message = optionalText(data?.message, 2000, 'Nachricht');
    if (data?.privacy !== true) throw new BookingError('Bitte bestätige die Datenschutzerklärung.');

    await verifyTurnstile(data?.turnstileToken, 'reservation-request');
    if (!await takeRateLimit(`reservation-request:${details.email}`, 5, 15 * 60000)) {
      return { success: false, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' };
    }

    const idempotencyKey = data?.idempotencyKey ? uuid(data.idempotencyKey, 'Anfrage-ID') : randomUUID();
    const result = await db.transaction(async tx => {
      await lockLayout(tx);
      const event = await lockEvent(tx, eventId);
      if (event.reservationMode !== 'email') throw new BookingError('Für dieses Event sind keine E-Mail-Reservierungen möglich.');
      if (event.reservationDeadline && event.reservationDeadline.getTime() < Date.now()) {
        throw new BookingError('Der Reservierungszeitraum für dieses Event ist beendet.');
      }

      const [existing] = await tx.select().from(reservations).where(eq(reservations.idempotencyKey, idempotencyKey));
      if (existing) {
        if (existing.eventId !== eventId || existing.email !== details.email) throw new BookingError('Anfrage-ID bereits anderweitig verwendet.', 409);
        return { event, reservation: existing, created: false };
      }

      const allowed = Array.isArray(event.reservableDates) && event.reservableDates.length
        ? event.reservableDates
        : [new Date(event.date).toISOString().slice(0, 10)];
      if (!allowed.includes(day.toISOString().slice(0, 10))) throw new BookingError('Datum nicht buchbar.');

      const [created] = await tx.insert(reservations).values({
        id: randomUUID(),
        idempotencyKey,
        eventId,
        reservationDate: day,
        guestName: details.guestName,
        email: details.email,
        phone,
        guestCount: details.guestCount,
        selectedTime: time,
        amountTotal: 0,
        status: 'requested',
        source: 'email',
        groupLabel: club,
        groupSize: tablesRequested,
        notes: message,
        privacyVersion: PRIVACY_VERSION,
        privacyAcceptedAt: new Date(),
      }).returning();
      return { event, reservation: created, created: true };
    });

    let warning: string | undefined;
    if (result.created) {
      warning = await sendReservationRequestEmails(emailData(result.event, result.reservation));
      revalidatePath('/[locale]/admin', 'layout');
    }
    return { success: true, warning };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Anfrage konnte nicht gesendet werden.' };
  }
}

export async function confirmReservationRequest(
  reservationId: string,
  data: { tableId?: string | null; priceCents?: number | null } = {},
) {
  try {
    const staff = await requireAdmin();
    uuid(reservationId);
    if (data.tableId) uuid(data.tableId);
    if (data.priceCents !== undefined && data.priceCents !== null) {
      if (!Number.isInteger(data.priceCents) || data.priceCents < 0 || data.priceCents > 99999999) throw new BookingError('Ungültiger Preis.');
    }
    const result = await reservationAdmin(db).confirmRequest(reservationId, {
      tableId: data.tableId || null,
      priceCents: data.priceCents ?? null,
      actor: staff.email,
    });
    const customer = await ensureCustomerForReservation(db, result.reservation);
    if (result.reservation.customerId !== customer.id) {
      await linkReservationCustomer(db, result.reservation.id, customer.id);
    }
    const [table] = result.reservation.tableId
      ? await db.select({ name: tables.name }).from(tables).where(eq(tables.id, result.reservation.tableId))
      : [];
    const warning = await sendReservationConfirmation({
      ...emailData(result.event, result.reservation),
      tableName: table?.name || null,
      priceCents: result.reservation.agreedPriceCents,
    });
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, warning };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Anfrage konnte nicht bestätigt werden.' };
  }
}

export async function declineReservationRequest(reservationId: string, reason?: string) {
  try {
    const staff = await requireAdmin();
    uuid(reservationId);
    const cleanReason = optionalText(reason, 1000, 'Begründung');
    const result = await reservationAdmin(db).declineRequest(reservationId, {
      actor: staff.email,
      reason: cleanReason,
    });
    const warning = await sendReservationDecline(emailData(result.event, result.reservation), cleanReason);
    revalidatePath('/[locale]/admin', 'layout');
    return { success: true, warning };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Anfrage konnte nicht abgelehnt werden.' };
  }
}