import { NextResponse } from "next/server";
import { db } from "@/db";
import { eventDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function withTransformation(url: string, transformation: string) {
  return url.replace("/upload/", `/upload/${transformation}/`);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [document] = await db.select().from(eventDocuments).where(eq(eventDocuments.id, id)).limit(1);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!document.isPublic) {
    try { await requireAdmin(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  }

  // Candidate URLs: original first, then a transformed variant (helps with
  // Cloudinary accounts that require a transformation for PDF delivery).
  const candidates = [document.fileUrl];
  if (document.fileUrl.includes("/image/upload/") && document.fileUrl.toLowerCase().endsWith(".pdf")) {
    candidates.push(withTransformation(document.fileUrl, "f_auto"));
    candidates.push(withTransformation(document.fileUrl, "pg_1,f_webp"));
  }

  for (const url of candidates) {
    try {
      const upstream = await fetch(url);
      if (!upstream.ok || !upstream.body) continue;
      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${document.title || "document"}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ success: false, url: document.fileUrl, error: { code: 401, message: "deny or ACL failure" } }, { status: 401 });
}