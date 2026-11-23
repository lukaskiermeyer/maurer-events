import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eventDocuments, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/reservation-policy";

export const runtime = "nodejs";

function withTransformation(url: string, transformation: string) {
  return url.replace("/upload/", `/upload/${transformation}/`);
}

function cloudinaryUrl(value: string): URL | null {
  try {
    const target = new URL(value);
    if (target.protocol !== "https:" || target.hostname !== "res.cloudinary.com" || target.username || target.password || (target.port && target.port !== "443")) return null;
    return target;
  } catch {
    return null;
  }
}

function safeFilename(title: string) {
  return title.replace(/[\r\n"\\/]/g, "_").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 150) || "document";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select({ document: eventDocuments, event: events }).from(eventDocuments)
    .innerJoin(events, eq(events.id, eventDocuments.eventId))
    .where(eq(eventDocuments.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { document, event } = row;
  const publiclyVisible = document.isPublic && event.isPublished && !event.deletedAt;

  if (!publiclyVisible) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } }); }
  }

  const candidates = [document.fileUrl];
  if (document.fileUrl.includes("/image/upload/") && document.fileUrl.toLowerCase().endsWith(".pdf")) {
    candidates.push(withTransformation(document.fileUrl, "f_auto"));
    candidates.push(withTransformation(document.fileUrl, "pg_1,f_webp"));
  }

  for (const candidate of candidates) {
    const target = cloudinaryUrl(candidate);
    if (!target) continue;
    try {
      const upstream = await fetch(target, { redirect: "error", cache: "no-store" });
      if (!upstream.ok || !upstream.body) continue;
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": document.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${safeFilename(document.title)}"`,
          "Cache-Control": publiclyVisible ? "public, max-age=3600" : "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { success: false, error: "Datei konnte nicht geladen werden." },
    { status: 502, headers: { "Cache-Control": publiclyVisible ? "no-store" : "private, no-store" } },
  );
}
