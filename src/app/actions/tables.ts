"use server";

import { db } from "@/db";
import { reservations, tables } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function generateTableGrid(rows: number, cols: number, capacityPerTable: number = 8) {
  try {
    // 1. Unassign all reservations from tables to prevent foreign key errors
    await db.update(reservations).set({ tableId: null });

    // 2. Delete all existing tables
    await db.delete(tables);

    // 3. Generate new grid
    // We want the grid to fit nicely into the 100x100 percentage layout
    // Let's leave a 10% margin on the edges.
    const startX = 10;
    const startY = 10;
    const endX = 90;
    const endY = 90;

    const stepX = cols > 1 ? (endX - startX) / (cols - 1) : 0;
    const stepY = rows > 1 ? (endY - startY) / (rows - 1) : 0;

    const newTables = [];
    let tableNumber = 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newTables.push({
          name: `Tisch ${tableNumber}`,
          capacity: capacityPerTable,
          positionX: cols === 1 ? 50 : Math.round(startX + (col * stepX)),
          positionY: rows === 1 ? 50 : Math.round(startY + (row * stepY)),
        });
        tableNumber++;
      }
    }

    if (newTables.length > 0) {
      await db.insert(tables).values(newTables);
    }

    revalidatePath("/admin/reservations");
    return { success: true };
  } catch (err: any) {
    console.error("Fehler beim Generieren der Tische:", err);
    return { success: false, error: err.message };
  }
}
