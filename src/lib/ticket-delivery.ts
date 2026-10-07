import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { events, reservations, tables } from '@/db/schema';
import { generateTicketPdf } from './ticket';
import { escapeHtml } from './escape';
import { Resend } from 'resend';
import { emailFrom } from './email';

import type { CreateEmailOptions } from 'resend';

export async function deliverTicket(reservationId: string, connection = db, send?: (payload: CreateEmailOptions, key: string) => Promise<{ error: unknown }>): Promise<string | undefined> {
  try {
  let [reservation] = await connection.select().from(reservations).where(eq(reservations.id, reservationId));
  if (!reservation || reservation.status !== 'confirmed' || !reservation.qrCodeText) return;
  if (reservation.ticketSentAt) return;
  if (!send && !process.env.RESEND_API_KEY) return 'E-Mail-Versand ist nicht konfiguriert. Bitte die Bestätigung erneut auslösen.';
    // A moved/cancelled reservation must not re-send its earlier saved payload.
    const [latest] = await connection.select().from(reservations).where(eq(reservations.id, reservationId));
    if (latest.status !== 'confirmed' || latest.qrCodeText !== reservation.qrCodeText || latest.ticketSentAt) return;
    if (!reservation.ticketEmailPayload) {
      const [event] = await connection.select().from(events).where(eq(events.id, reservation.eventId));
      const [table] = reservation.tableId ? await connection.select().from(tables).where(eq(tables.id, reservation.tableId)) : [];
      const pdf = await generateTicketPdf({ eventName: event?.title || 'Maurer Event', date: reservation.reservationDate.toLocaleDateString('de-DE', { timeZone: 'UTC' }), time: reservation.selectedTime, location: event?.location, guestName: reservation.guestName, guestCount: reservation.guestCount, tableName: table?.name || 'Freie Platzwahl', qrCodeText: reservation.qrCodeText });
      if (!pdf) throw new Error('PDF unavailable');
      const payload = { from: emailFrom(), to: [reservation.email], subject: `Dein Ticket für ${event?.title || 'Maurer Event'}`,
        html: `<p>Hallo ${escapeHtml(reservation.guestName)},</p><p>Im Anhang findest du dein Ticket mit QR-Code.</p>`, attachments: [{ filename: 'ticket.pdf', content: pdf.toString('base64') }] };
      // Freeze the full email, including PDF bytes, before calling the provider.
      await connection.update(reservations).set({ ticketEmailPayload: payload }).where(and(eq(reservations.id, reservation.id), eq(reservations.qrCodeText, reservation.qrCodeText), eq(reservations.status, 'confirmed'), isNull(reservations.ticketEmailPayload)));
      const [current] = await connection.select().from(reservations).where(eq(reservations.id, reservation.id));
      if (current.status !== 'confirmed' || current.qrCodeText !== reservation.qrCodeText || !current.ticketEmailPayload || current.ticketSentAt) return;
      reservation = current;
    }
    const key = `ticket:${reservation.id}:${reservation.qrCodeText}`;
    const payload = reservation.ticketEmailPayload as unknown as CreateEmailOptions;
    const result = send ? await send(payload, key) : await new Resend(process.env.RESEND_API_KEY).emails.send(payload, { idempotencyKey: key });
    if (result.error) throw new Error('Email delivery failed');
    await connection.update(reservations).set({ ticketSentAt: new Date() }).where(and(eq(reservations.id, reservation.id), eq(reservations.qrCodeText, reservation.qrCodeText), eq(reservations.status, 'confirmed')));
  } catch {
    return 'Ticket-E-Mail konnte nicht gesendet werden. Bitte die Bestätigung erneut auslösen.';
  }
}
