"use server";

import { db } from "@/db";
import { tables, reservations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { saveTentSettings } from "./settings";

export async function getTables() {
  return db.select().from(tables);
}

export async function createTable(data: { name: string; capacity: number; positionX?: number; positionY?: number }) {
  await db.insert(tables).values({
    name: data.name,
    capacity: data.capacity,
    positionX: data.positionX ?? 0,
    positionY: data.positionY ?? 0
  });
  revalidatePath("/admin/events/[id]", "page");
}

export async function deleteTable(id: string) {
  await db.update(reservations).set({ tableId: null }).where(eq(reservations.tableId, id));
  await db.delete(tables).where(eq(tables.id, id));
  
  // Auto-renumber remaining tables
  const remainingTables = await db.select().from(tables);
  
  // Sort by Y first (row), then X (column)
  remainingTables.sort((a, b) => {
    if (a.positionY === b.positionY) {
      return a.positionX - b.positionX;
    }
    return a.positionY - b.positionY;
  });

  // Update names sequentially
  for (let i = 0; i < remainingTables.length; i++) {
    const table = remainingTables[i];
    const newName = `Tisch ${i + 1}`;
    if (table.name !== newName) {
      await db.update(tables).set({ name: newName }).where(eq(tables.id, table.id));
    }
  }

  revalidatePath("/admin/events/[id]", "page");
}

export async function updateTablePosition(id: string, x: number, y: number) {
  await db.update(tables).set({ positionX: x, positionY: y }).where(eq(tables.id, id));
  revalidatePath("/admin/events/[id]", "page");
}

export async function toggleTableVip(id: string, isVip: boolean, vipPrice: number = 0) {
  await db.update(tables).set({ isVip, vipPrice }).where(eq(tables.id, id));
  revalidatePath("/admin/events/[id]", "page");
}

export async function getBookedTableIds(eventId: string, dateStr: string) {
  const { and, ne } = await import("drizzle-orm");
  const booked = await db.select({ tableId: reservations.tableId })
    .from(reservations)
    .where(
      and(
        eq(reservations.eventId, eventId),
        eq(reservations.reservationDate, new Date(dateStr)),
        ne(reservations.status, 'cancelled')
      )
    );
  return booked.filter(b => b.tableId !== null).map(b => b.tableId as string);
}

export async function generateTentLayout(tablesWidth: number, tablesLength: number, capacity: number) {
  // Unassign all reservations to avoid foreign key violations
  await db.update(reservations).set({ tableId: null });
  // Delete all existing tables
  await db.delete(tables);
  
  const gridWidth = tablesWidth + 1; // Middle aisle
  const gridHeight = tablesLength + Math.floor(tablesLength / 2); // Aisle every 2 rows
  
  let tableIndex = 1;
  const newTables = [];
  
  for (let y = 0; y < tablesLength; y++) {
    const gridY = y + Math.floor(y / 2);
    for (let x = 0; x < tablesWidth; x++) {
      const gridX = x < Math.floor(tablesWidth / 2) ? x : x + 1;
      newTables.push({
        name: `Tisch ${tableIndex}`,
        capacity: capacity,
        positionX: gridX,
        positionY: gridY
      });
      tableIndex++;
    }
  }
  
  if (newTables.length > 0) {
    await db.insert(tables).values(newTables);
  }
  
  await saveTentSettings(gridWidth, gridHeight);
  revalidatePath("/admin/events/[id]", "page");
}
