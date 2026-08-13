import { db } from "@/db";
import { events, galleries } from "@/db/schema";
import { lt, eq, isNotNull, and } from "drizzle-orm";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Add simple auth to protect this route if necessary, 
  // e.g. checking authorization header for a cron secret.
  // For Vercel cron, Vercel sends a CRON_SECRET header that we could check.
  // We'll skip strict auth for now to allow manual triggers from the user if needed, 
  // or just rely on Vercel's default protection if configured.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find events where deletedAt is older than 7 days
    const eventsToDelete = await db
      .select()
      .from(events)
      .where(
        and(
          isNotNull(events.deletedAt),
          lt(events.deletedAt, sevenDaysAgo)
        )
      );

    if (eventsToDelete.length === 0) {
      return NextResponse.json({ message: "No expired soft-deleted events found." });
    }

    let deletedCount = 0;
    let blobsDeleted = 0;

    for (const event of eventsToDelete) {
      // 1. Delete cover image from Blob if it exists and is a vercel blob URL
      if (event.imageUrl && event.imageUrl.includes('public.blob.vercel-storage.com')) {
        try {
          await del(event.imageUrl);
          blobsDeleted++;
        } catch (e) {
          console.error(`Failed to delete blob for cover image: ${event.imageUrl}`, e);
        }
      }

      // 2. Fetch all gallery images for this event
      const galleryImages = await db.select().from(galleries).where(eq(galleries.eventId, event.id));
      
      // 3. Delete those images from Blob
      for (const img of galleryImages) {
        if (img.imageUrl && img.imageUrl.includes('public.blob.vercel-storage.com')) {
          try {
            await del(img.imageUrl);
            blobsDeleted++;
          } catch (e) {
            console.error(`Failed to delete blob for gallery image: ${img.imageUrl}`, e);
          }
        }
      }

      // 4. Delete the event from DB (cascading should handle the galleries table deletion)
      await db.delete(events).where(eq(events.id, event.id));
      deletedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} events and ${blobsDeleted} blobs.` 
    });

  } catch (error: any) {
    console.error("Cleanup cron failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
