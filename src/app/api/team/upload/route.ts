import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, staffDocuments } from "@/db/schema";
import { requireStaffMember } from "@/lib/staff-auth";
import { ALLOWED_UPLOAD_TYPES as ALLOWED, DOCUMENT_KINDS, MAX_UPLOAD_BYTES as MAX_BYTES, sniffMime } from "@/lib/file-types";

export const runtime = "nodejs";

export { ALLOWED, DOCUMENT_KINDS, MAX_BYTES, sniffMime };

function signature(params: Record<string, string>, secret: string) {
  const base = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return crypto.createHash("sha1").update(`${base}${secret}`).digest("hex");
}

async function upload(file: File, publicId: string, resourceType: "image" | "raw" = "image") {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary ist nicht konfiguriert.");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "maurer-events/staff";
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("public_id", publicId);
  body.append("signature", signature({ folder, public_id: publicId, timestamp }, apiSecret));
  // PDFs als raw – sonst blockt Cloudinary die Auslieferung und "Öffnen" bricht ab.
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    const raw = data?.error?.message || "Upload fehlgeschlagen.";
    // Cloudinary-RBAC: API-Schlüssel darf keine Assets anlegen (häufig nach Cloudinary-Rollen-Migration).
    if (response.status === 403 || (typeof raw === "string" && raw.includes("missing permissions"))) {
      console.error("Cloudinary forbidden", { status: response.status, error: raw, cloudName });
      throw new Error("Upload nicht erlaubt: Der Cloudinary-Schlüssel darf keine Dateien anlegen. Bitte in Cloudinary (Console → Settings → API Keys → Permissions) die Berechtigung „Create assets“ für diesen Schlüssel aktivieren.");
    }
    console.error("Cloudinary upload failed", { status: response.status, error: raw, cloudName });
    throw new Error(raw);
  }
  return data as { secure_url: string; public_id: string };
}

export async function POST(request: Request) {
  try {
    const member = await requireStaffMember();
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BYTES + 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max. 10 MB)." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Nur PDF, JPG, PNG und WebP erlaubt." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Datei zu groß (max. 10 MB)." }, { status: 413 });
    if (file.size === 0) return NextResponse.json({ error: "Datei ist leer." }, { status: 400 });

    // Validierung VOR dem Cloudinary-Upload, damit keine Waisen-Files entstehen.
    const kind = String(form.get("kind") || "other");
    const contractId = form.get("contractId");
    let contract: { id: string } | undefined;
    if (typeof contractId === "string" && contractId) {
      const [found] = await db.select().from(contracts).where(and(eq(contracts.id, contractId), eq(contracts.staffId, member.id)));
      if (!found) return NextResponse.json({ error: "Vertrag nicht gefunden." }, { status: 404 });
      contract = { id: found.id };
    } else if (!DOCUMENT_KINDS.has(kind)) {
      return NextResponse.json({ error: "Ungültige Dokumentart." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) return NextResponse.json({ error: "Datei ist leer." }, { status: 400 });
    const detected = sniffMime(buffer);
    if (!detected || detected !== file.type) return NextResponse.json({ error: "Dateiinhalt entspricht nicht dem angegebenen Typ." }, { status: 400 });

    const uploaded = await upload(file, crypto.randomUUID(), detected === "application/pdf" ? "raw" : "image");

    if (contract) {
      return NextResponse.json({ success: true, fileUrl: uploaded.secure_url, sha256: crypto.createHash("sha256").update(buffer).digest("hex") });
    }

    const [document] = await db.insert(staffDocuments).values({
      staffId: member.id,
      kind,
      fileUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: detected,
      status: "pending",
    }).returning();
    return NextResponse.json({ success: true, document });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload fehlgeschlagen." }, { status: 400 });
  }
}
