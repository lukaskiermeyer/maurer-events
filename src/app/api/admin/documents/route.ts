import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eventDocuments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { optimizeImage } from "@/lib/imageOptimizer";
import { uuid } from "@/lib/reservation-policy";
import { translateFields } from "@/lib/translate";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const FOLDER = "maurer-events/documents";

function signature(params: Record<string, string>, secret: string) {
  const base = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return crypto.createHash("sha1").update(`${base}${secret}`).digest("hex");
}

async function upload(file: File, resourceType: "image" | "raw", publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary ist nicht konfiguriert.");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = { folder: FOLDER, public_id: publicId, timestamp };
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", FOLDER);
  body.append("public_id", publicId);
  body.append("signature", signature(signed, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) throw new Error(data?.error?.message || "Upload fehlgeschlagen.");
  return data as { secure_url: string; public_id: string };
}

export async function POST(request: Request) {
  try {
    const staff = await requireAdmin();
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES + 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max 15 MB)." }, { status: 413 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Nur PDF, JPG, PNG und WebP erlaubt." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Datei zu groß (max 15 MB)." }, { status: 413 });

    const eventId = uuid(form.get("eventId"), "Event-ID");
    const kind = form.get("kind");
    if (kind !== "menu" && kind !== "program") return NextResponse.json({ error: "Ungültige Dokumentart." }, { status: 400 });
    const rawTitle = form.get("title");
    const title = typeof rawTitle === "string" && rawTitle.trim()
      ? rawTitle.trim().slice(0, 150)
      : file.name.replace(/\.[^.]+$/, "").slice(0, 150);
    const isPublic = form.get("isPublic") !== "false";
    const publicId = crypto.randomUUID();
    const isPdf = file.type === "application/pdf";
    let fileUrl: string;
    let previewUrl: string | null;
    let mimeType: string;
    let sizeBytes: number;
    let warning: string | undefined;

    if (isPdf) {
      // PDFs als "raw" hochladen, damit die Datei öffentlich abrufbar ist
      // (image/upload liefert für PDFs häufig 401 "deny or ACL failure").
      const uploaded = await upload(file, "raw", publicId);
      fileUrl = uploaded.secure_url;
      mimeType = "application/pdf";
      sizeBytes = file.size;
      previewUrl = null;
      // Vorschau best-effort über den Image-Pipeline versuchen.
      try {
        const previewUpload = await upload(file, "image", `${publicId}_preview`);
        previewUrl = previewUpload.secure_url.replace("/upload/", "/upload/pg_1,f_webp,w_1600,q_auto/");
      } catch {
        previewUrl = null;
        warning = "PDF wurde gespeichert. Vorschau nicht verfügbar.";
      }
    } else {
      const optimized = await optimizeImage(file, { maxWidth: 1920, quality: 82, format: "webp" });
      const webp = new File([new Uint8Array(optimized.buffer)], `${title || "dokument"}.webp`, { type: "image/webp" });
      const uploaded = await upload(webp, "image", publicId);
      fileUrl = uploaded.secure_url;
      previewUrl = uploaded.secure_url;
      mimeType = "image/webp";
      sizeBytes = optimized.size;
    }

    const translatedTitle = await translateFields({ title });
    const [document] = await db.insert(eventDocuments).values({
      eventId,
      kind,
      title,
      titleEn: translatedTitle.en.title,
      titleBar: translatedTitle.bar.title,
      fileUrl,
      previewUrl,
      publicId,
      mimeType,
      sizeBytes,
      isPublic,
      createdBy: staff.email,
    }).returning();
    revalidatePath("/[locale]", "layout");
    return NextResponse.json({ success: true, document, warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}