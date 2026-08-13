import { db } from "@/db";
import { events } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  await db.update(events).set({ type: 'gallery' });
  return NextResponse.json({ success: true });
}
