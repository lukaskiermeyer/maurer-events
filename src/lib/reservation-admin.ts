import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { events, reservations, tables } from '@/db/schema';
import { assertCapacity, lockEvent, lockLayout, lockReservation } from './reservation-db';
import { ADMIN_TRANSITIONS, assertEventDay, BookingError, calendarDate, guestDetails, uuid } from './reservation-policy';
import { toCalendarDay } from './date';

export function reservationAdmin(connection: typeof db) {
  return {
    async assign(reservationId: string, tableId: string | null) {
      uuid(reservationId); if (tableId !== null) uuid(tableId);
      await connection.transaction(async tx => {
        await lockLayout(tx);
        const { event, reservation } = await lockReservation(tx, reservationId);
        if (reservation.tableId === tableId) return;
        if (!['paid', 'confirmed'].includes(reservation.status)) throw new BookingError('Tische können nur bezahlten, noch nicht eingecheckten Buchungen zugewiesen werden.');
        if (reservation.tableId) {
          // Lock both tables in a stable order to avoid deadlocks on simultaneous swaps.
          await tx.select().from(tables).where(inArray(tables.id, [reservation.tableId, tableId].filter(Boolean))).orderBy(tables.id).for('update');
        }
        await assertCapacity(tx, event, toCalendarDay(reservation.reservationDate), reservation.guestCount, tableId, reservation.id);
        // Replace stale tickets after a move; the old code becomes invalid.
        await tx.update(reservations).set({ tableId, updatedAt: new Date(), qrCodeText: reservation.qrCodeText ? randomUUID() : null, ticketEmailPayload: null, ticketSentAt: null }).where(eq(reservations.id, reservation.id));
      });
    },
    async status(reservationId: string, status: string) {
      uuid(reservationId);
      return connection.transaction(async tx => {
        await lockLayout(tx);
        const { event, reservation } = await lockReservation(tx, reservationId);
        if (reservation.status === status) return reservation;
        if (!ADMIN_TRANSITIONS[reservation.status]?.includes(status)) throw new BookingError(`Status-Übergang von '${reservation.status}' zu '${status}' nicht erlaubt.`);
        if ((reservation.stripeSessionId || reservation.checkoutParams) && ['paid', 'confirmed'].includes(status) && !['paid', 'confirmed'].includes(reservation.status)) throw new BookingError('Online-Zahlungen werden ausschließlich durch den Zahlungsdienst bestätigt.');
        if (['paid', 'confirmed', 'checked_in'].includes(status)) {
          assertEventDay(event, toCalendarDay(reservation.reservationDate));
          await assertCapacity(tx, event, toCalendarDay(reservation.reservationDate), reservation.guestCount, reservation.tableId, reservation.id);
        }
        if (status === 'checked_in' && !reservation.qrCodeText) throw new BookingError('Für diese Buchung wurde noch kein Ticket ausgestellt.');
        const [updated] = await tx.update(reservations).set({
          status: status as typeof reservation.status, updatedAt: new Date(),
          qrCodeText: status === 'confirmed' ? reservation.qrCodeText || randomUUID() : status === 'cancelled' ? null : reservation.qrCodeText,
          pdfUrl: status === 'cancelled' ? null : reservation.pdfUrl,
          scannedAt: status === 'checked_in' ? new Date() : reservation.scannedAt,
        }).where(eq(reservations.id, reservation.id)).returning();
        return updated;
      });
    },
    async manual(data: { eventId: string; guestName: string; email: string; guestCount: number; reservationDate: string; idempotencyKey: string }) {
      const eventId = uuid(data?.eventId);
      const id = uuid(data?.idempotencyKey, 'Buchungs-ID');
      const details = guestDetails(data?.guestName, data?.email, data?.guestCount);
      const day = calendarDate(data?.reservationDate);
      return connection.transaction(async tx => {
        await lockLayout(tx);
        // Same lock order as checkout; manual UUID doubles as stable reservation ID.
        const event = await lockEvent(tx, eventId);
        const [existing] = await tx.select().from(reservations).where(eq(reservations.id, id));
        if (existing) {
          if (existing.eventId !== eventId || existing.guestName !== details.guestName || existing.email !== details.email || existing.guestCount !== details.guestCount || existing.reservationDate.getTime() !== day.getTime()) throw new BookingError('Buchungsschlüssel bereits anderweitig verwendet.', 409);
          return existing;
        }
        assertEventDay(event, day);
        await assertCapacity(tx, event, day, details.guestCount, null);
        const [created] = await tx.insert(reservations).values({ id, eventId, ...details, reservationDate: day, status: 'paid', amountTotal: 0 }).returning();
        return created;
      });
    },
    async scan(qrCodeText: string, eventId?: string) {
      if (typeof qrCodeText !== 'string' || !qrCodeText || qrCodeText.length > 200) throw new BookingError('Ungültiger Ticket-Code.');
      if (eventId) uuid(eventId);
      const [updated] = await connection.update(reservations).set({ status: 'checked_in', scannedAt: new Date(), updatedAt: new Date() }).where(and(
        eq(reservations.qrCodeText, qrCodeText), eventId ? eq(reservations.eventId, eventId) : undefined,
        inArray(reservations.status, ['paid', 'confirmed']), isNull(reservations.scannedAt),
      )).returning();
      if (!updated) throw new BookingError('Ticket ungültig, storniert oder bereits eingecheckt.');
      const [event] = await connection.select({ title: events.title }).from(events).where(eq(events.id, updated.eventId));
      const [table] = updated.tableId ? await connection.select({ name: tables.name }).from(tables).where(eq(tables.id, updated.tableId)) : [];
      return { reservation: updated, eventTitle: event?.title || 'Maurer Event', tableName: table?.name || 'Kein Tisch' };
    },
  };
}
