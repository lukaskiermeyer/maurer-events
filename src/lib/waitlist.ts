import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { waitlists } from '@/db/schema';
import { lockEvent, lockLayout } from './reservation-db';
import { BookingError, guestDetails, uuid } from './reservation-policy';

export async function enterWaitlist(connection: typeof db, data: { eventId: string; name: string; email: string; guestCount: number }) {
  const eventId = uuid(data?.eventId);
  const details = guestDetails(data?.name, data?.email, data?.guestCount);
  await connection.transaction(async tx => {
    await lockLayout(tx);
    const event = await lockEvent(tx, eventId);
    if (!event.reservable || event.type !== 'event') throw new BookingError('Event nicht buchbar.');
    const [existing] = await tx.select({ id: waitlists.id }).from(waitlists).where(and(eq(waitlists.eventId, eventId), sql`lower(trim(${waitlists.email})) = ${details.email}`)).limit(1);
    if (existing) return;
    await tx.insert(waitlists).values({ eventId, name: details.guestName, email: details.email, guestCount: details.guestCount });
  });
}
