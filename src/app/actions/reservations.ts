"use server";

import { db } from "@/db";
import { reservations, events, tables } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  await db.update(reservations).set({ tableId }).where(eq(reservations.id, reservationId));
  revalidatePath("/admin/reservations");
}

export async function updateReservationStatus(reservationId: string, status: string) {
  await db.update(reservations).set({ status }).where(eq(reservations.id, reservationId));
  revalidatePath("/admin/reservations");
}

export async function createManualReservation(data: {
  eventId: string;
  guestName: string;
  email: string;
  guestCount: number;
  reservationDate: string;
}) {
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
