import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, staffDocuments } from "@/db/schema";
import { staffSession as adminSession } from "@/lib/staff-access";
import { staffSession as memberSession } from "@/lib/staff-auth";
import { UUID_PATTERN } from "@/lib/reservation-policy";

export const runtime = "nodejs";

async function authorizedStaffId() {
  const store = await cookies();
  const adminToken = store.get("admin_token")?.value;
  const admin = await adminSession(db, adminToken).catch(() => null);
  if (admin?.role === "admin") return { isAdmin: true, staffId: null as string | null };
  const staffToken = store.get("staff_token")?.value;
  const member = await memberSession(staffToken).catch(() => null);
  if (member) return { isAdmin: false, staffId: member.member.id as string };
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  const contractId = searchParams.get("contractId");
  const auth = await authorizedStaffId();
  if (!auth) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  let cloudinaryUrl: string | null = null;
  let mimeType = "application/octet-stream";
  if (documentId) {
    if (!UUID_PATTERN.test(documentId)) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
    const [doc] = await db.select().from(staffDocuments).where(eq(staffDocuments.id, documentId));
    if (!doc) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    if (!auth.isAdmin && doc.staffId !== auth.staffId) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    cloudinaryUrl = doc.fileUrl;
    mimeType = doc.mimeType || mimeType;
  } else if (contractId) {
    if (!UUID_PATTERN.test(contractId)) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
    const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    if (!c || !c.signedFileUrl) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    if (!auth.isAdmin && c.staffId !== auth.staffId) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    cloudinaryUrl = c.signedFileUrl;
  } else {
    return NextResponse.json({ error: "documentId oder contractId fehlt." }, { status: 400 });
  }

  // SSRF-Schutz: nur Cloudinary-URLs abrufen
  let target: URL;
  try { target = new URL(cloudinaryUrl); } catch { return NextResponse.json({ error: "Ungültiger Speicher-Link." }, { status: 400 }); }
  if (target.hostname !== "res.cloudinary.com") return NextResponse.json({ error: "Ungültiger Speicher-Link." }, { status: 400 });

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Datei konnte nicht geladen werden." }, { status: upstream.status || 502 });
  const contentType = upstream.headers.get("content-type") || mimeType;
  const disposition = target.pathname.split("/").pop() || "datei";
  return new NextResponse(upstream.body as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${disposition.replace(/["\n]/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
