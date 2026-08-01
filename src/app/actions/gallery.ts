"use server";

import { db } from "@/db";
import { galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addGalleryImage(eventId: string, imageUrl: string) {
  await db.insert(galleries).values({
    eventId,
    imageUrl,
  });
  revalidatePath("/admin/events/[id]", "page");
  revalidatePath(`/termine/${eventId}`);
}

export async function removeGalleryImage(imageId: string) {
  await db.delete(galleries).where(eq(galleries.id, imageId));
  revalidatePath("/admin/events/[id]", "page");
}

export async function getGalleryImages(eventId: string) {
  return await db.select().from(galleries).where(eq(galleries.eventId, eventId));
}
