import { and, eq, isNull, sql } from "drizzle-orm";
import { customers, reservations } from "@/db/schema";
import type { db } from "@/db";
import { normalizeEmail, normalizeName, normalizePhone } from "./customer-import";

export async function ensureCustomerForReservation(connection: typeof db, reservation: typeof reservations.$inferSelect) {
  const email = normalizeEmail(reservation.email);
  if (email) {
    const [existing] = await connection.select().from(customers).where(and(sql`lower(trim(${customers.email})) = ${email}`, isNull(customers.deletedAt)));
    if (existing) return existing;
  }
  const phone = normalizePhone(reservation.phone);
  if (phone) {
    const [existing] = await connection.select().from(customers).where(and(
      sql`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g') = ${phone}`,
      sql`lower(trim(${customers.displayName})) = ${normalizeName(reservation.guestName)}`,
      isNull(customers.deletedAt),
    ));
    if (existing) return existing;
  }
  try {
    const [created] = await connection.insert(customers).values({
      displayName: reservation.guestName,
      company: reservation.groupLabel,
      email,
      phone: reservation.phone,
      source: "request",
      externalSource: "reservation",
      externalRef: reservation.id,
    }).returning();
    return created;
  } catch {
    if (email) {
      const [existing] = await connection.select().from(customers).where(sql`lower(trim(${customers.email})) = ${email}`);
      if (existing) return existing;
    }
    throw new Error("Kunde konnte nicht angelegt werden.");
  }
}

export async function linkReservationCustomer(connection: typeof db, reservationId: string, customerId: string) {
  await connection.update(reservations).set({ customerId, updatedAt: new Date() }).where(eq(reservations.id, reservationId));
}