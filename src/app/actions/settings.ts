"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getTentSettings() {
  const result = await db.select().from(settings).where(eq(settings.key, "tent_dimensions"));
  if (result.length > 0) {
    return JSON.parse(result[0].value);
  }
  // Default to 10x8 if not set
  return { width: 10, height: 8 };
}

export async function saveTentSettings(width: number, height: number) {
  const value = JSON.stringify({ width, height });
  
  const existing = await db.select().from(settings).where(eq(settings.key, "tent_dimensions"));
  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, "tent_dimensions"));
  } else {
    await db.insert(settings).values({ key: "tent_dimensions", value });
  }
}
