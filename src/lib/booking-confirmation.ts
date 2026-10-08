import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reservations } from '@/db/schema';

export type BookingConfirmationState = 'success' | 'pending' | 'unavailable';

// Only the persisted payment status can confirm a booking. Returning from
// Stripe alone also happens while delayed payments are still being processed.
export async function getBookingConfirmation(sessionId: unknown, connection = db): Promise<BookingConfirmationState> {
  if (typeof sessionId !== 'string' || !/^cs_[a-zA-Z0-9_-]{10,200}$/.test(sessionId)) return 'unavailable';
  try {
    const [reservation] = await connection.select({ status: reservations.status })
      .from(reservations).where(eq(reservations.stripeSessionId, sessionId)).limit(1);
    if (!reservation) return 'unavailable';
    if (['paid', 'confirmed', 'checked_in'].includes(reservation.status)) return 'success';
    if (['pending', 'payment_pending'].includes(reservation.status)) return 'pending';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
