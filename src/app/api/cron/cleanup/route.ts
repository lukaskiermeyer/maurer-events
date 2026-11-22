import { db } from "@/db";
import { events, galleries, galleryAlbums, reservations, adminAuth, adminSessions, securityRateLimits } from "@/db/schema";
import { lt, eq, isNotNull, and, or, isNull } from "drizzle-orm";
import { deleteCloudinaryImage } from "@/lib/cloudinary";
import { NextResponse } from "next/server";
import Stripe from 'stripe';
import { reconcileExpiredReservations } from '@/lib/reservation-cleanup';
import { deliverTicket } from '@/lib/ticket-delivery';
import { reservationAdmin } from '@/lib/reservation-admin';
import { eventSettings } from '@/db/schema';
import { runRetentionCleanup } from '@/lib/retention';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    let updatedReservationsCount = 0;
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia', timeout: 10000, maxNetworkRetries: 1 });
      updatedReservationsCount = await reconcileExpiredReservations(db, stripe);
    }
    await db.delete(adminAuth).where(lt(adminAuth.expiresAt, new Date()));
    await db.delete(adminSessions).where(lt(adminSessions.validUntil, new Date()));
    await db.delete(securityRateLimits).where(lt(securityRateLimits.resetAt, new Date()));
    const retention = await runRetentionCleanup(db);
    // Cloudinary-Purge für gelöschte Staff-Dokumente/Verträge (Best Effort).
    let purgedCloudinary = 0;
    for (const url of [...(retention.purgedIdDocUrls || []), ...(retention.purgedAnonymizeUrls || [])]) {
      try {
        if (await deleteCloudinaryImage(url)) purgedCloudinary++;
      } catch { /* best effort */ }
    }
    // Payment commits are independent from email availability. Retry unsent tickets.
    const tickets = await db.select({ reservation: reservations, autoSend: eventSettings.autoSendTicket })
      .from(reservations).leftJoin(eventSettings, eq(eventSettings.eventId, reservations.eventId))
      .where(and(isNull(reservations.ticketSentAt), or(eq(reservations.status, 'paid'), eq(reservations.status, 'confirmed')))).limit(50);
    for (const { reservation, autoSend } of tickets) {
      if (reservation.status === 'paid' && !(autoSend ?? true)) continue;
      try {
        await reservationAdmin(db).status(reservation.id, 'confirmed');
        await deliverTicket(reservation.id);
      } catch { console.error('Ticket retry deferred:', reservation.id); }
    }

    // 2. Soft-deleted Events Cleanup (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const eventsToDelete = await db
      .select()
      .from(events)
      .where(
        and(
          isNotNull(events.deletedAt),
          lt(events.deletedAt, sevenDaysAgo)
        )
      );

    let deletedCount = 0;
    let blobsDeleted = 0;

    if (eventsToDelete.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const eventIds = eventsToDelete.map(e => e.id);

      // Finde alle Events mit Reservierungen in einer Query
      const eventsWithReservations = await db.select({ eventId: reservations.eventId })
        .from(reservations)
        .where(inArray(reservations.eventId, eventIds));

      const eventIdsWithReservations = new Set(eventsWithReservations.map(r => r.eventId));
      
      const safeEventsToDelete = eventsToDelete.filter(e => !eventIdsWithReservations.has(e.id));
      const safeEventIds = safeEventsToDelete.map(e => e.id);

      for (const event of safeEventsToDelete) {
        if (event.imageUrl) {
          try {
            await deleteCloudinaryImage(event.imageUrl);
            blobsDeleted++;
          } catch (e) {
            console.error("Failed to delete blob for cover image (URL redacted).", e instanceof Error ? e.name : "Unknown");
          }
        }
      }

      if (safeEventIds.length > 0) {
        // Galerie-Alben sind eigenständig und überleben das Event (event_id -> null).
        // Beim Event-Löschen werden deshalb keine Galeriebilder mehr entfernt.
        await db.delete(events).where(inArray(events.id, safeEventIds));
        deletedCount = safeEventIds.length;
      }
    }

    // 3. Soft-deleted Galerie-Alben (älter als 7 Tage): Bilder- + Cover-Blobs löschen,
    //    dann das Album entfernen (galleries-Zeilen folgen per ON DELETE CASCADE).
    let deletedAlbums = 0;
    const albumsToDelete = await db.select().from(galleryAlbums)
      .where(and(isNotNull(galleryAlbums.deletedAt), lt(galleryAlbums.deletedAt, sevenDaysAgo)));
    if (albumsToDelete.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const albumIds = albumsToDelete.map(a => a.id);
      const albumImages = await db.select().from(galleries).where(inArray(galleries.albumId, albumIds));
      for (const img of albumImages) {
        if (img.imageUrl) {
          try {
            await deleteCloudinaryImage(img.imageUrl);
            blobsDeleted++;
          } catch (e) {
            console.error("Failed to delete blob for gallery image (URL redacted).", e instanceof Error ? e.name : "Unknown");
          }
        }
      }
      for (const album of albumsToDelete) {
        if (album.coverImageUrl) {
          try {
            await deleteCloudinaryImage(album.coverImageUrl);
            blobsDeleted++;
          } catch (e) {
            console.error("Failed to delete blob for album cover (URL redacted).", e instanceof Error ? e.name : "Unknown");
          }
        }
      }
      await db.delete(galleryAlbums).where(inArray(galleryAlbums.id, albumIds));
      deletedAlbums = albumIds.length;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} events, ${deletedAlbums} gallery albums and ${blobsDeleted} blobs. Updated ${updatedReservationsCount} expired reservations.`,
      updatedReservationsCount,
      purgedCloudinary,
      retention,
    });

  } catch (error) {
    console.error("Cleanup cron failed:", error);
    return NextResponse.json({ success: false, error: 'Bereinigung vorübergehend fehlgeschlagen.' }, { status: 500 });
  }
}
