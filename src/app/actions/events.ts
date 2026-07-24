"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createEvent(data: {
  title: string;
  date: Date;
  location: string;
  description: string;
  imageUrl?: string;
  link: string;
  reservable: boolean;
}) {
  await db.insert(events).values(data);
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
}

export async function updateEvent(id: string, data: Partial<typeof events.$inferInsert>) {
  await db.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
}

export async function deleteEvent(id: string) {
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/termine/mit-reservierung");
  revalidatePath("/termine/ohne-reservierung");
}

export async function getEvents() {
  return await db.select().from(events).orderBy(asc(events.date));
}
