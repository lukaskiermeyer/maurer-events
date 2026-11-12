import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/db";
import { documentFormTemplates, staff as staffTable, staffDocuments, staffRoles } from "@/db/schema";
import { escapeHtml } from "./escape";
import { decryptField } from "./secure-fields";

type StaffRow = typeof staffTable.$inferSelect;
type RoleRow = typeof staffRoles.$inferSelect;

export type FormFieldBundle = {
  vorname: string; nachname: string; name: string; geburtsdatum: string;
  adresse: string; email: string; telefon: string; rolle: string; eintritt: string;
  stundensatz: string; steuerId: string; steuerklasse: string; kinderfreibetraege: string;
  sozialversicherungsnummer: string; krankenkasse: string; iban: string; bic: string; heute: string;
};

function dateDe(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString("de-DE") : "";
}

export function formValues(member: StaffRow, role: RoleRow | null): FormFieldBundle {
  const adresse = [member.street, [member.zip, member.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    vorname: member.firstName,
    nachname: member.lastName,
    name: `${member.firstName} ${member.lastName}`,
    geburtsdatum: dateDe(member.birthDate),
    adresse,
    email: member.email,
    telefon: member.phone || "",
    rolle: role?.name || "",
    eintritt: dateDe(member.entryDate),
    stundensatz: (member.hourlyRateCents / 100).toFixed(2).replace(".", ","),
    steuerId: decryptField(member.taxIdEnc) || "",
    steuerklasse: member.taxClass || "",
    kinderfreibetraege: String(member.childAllowances ?? 0),
    sozialversicherungsnummer: decryptField(member.socialSecurityEnc) || "",
    krankenkasse: member.healthInsurance || "",
    iban: decryptField(member.ibanEnc) || "",
    bic: member.bic || "",
    heute: new Date().toLocaleDateString("de-DE"),
  };
}

export function renderFormTemplate(bodyHtml: string, member: StaffRow, role: RoleRow | null) {
  const values = formValues(member, role);
  return bodyHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    escapeHtml(values[key as keyof FormFieldBundle] ?? ""),
  );
}

type Line = { text: string; size: number; bold: boolean; spaceBefore: number };

function htmlToLines(html: string): Line[] {
  const normalized = html
    .replace(/<\/(h1|h2|h3|p|li|div|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ");
  const text = normalized.replace(/<[^>]+>/g, (match) => (match.startsWith("<br") ? "\n" : ""));
  const decode = (value: string) =>
    value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const lines: Line[] = [];
  for (const raw of decode(text).split("\n")) {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("### ")) lines.push({ text: trimmed.slice(4), size: 13, bold: true, spaceBefore: 10 });
    else if (trimmed.startsWith("## ")) lines.push({ text: trimmed.slice(3), size: 16, bold: true, spaceBefore: 12 });
    else if (trimmed.startsWith("# ")) lines.push({ text: trimmed.slice(2), size: 20, bold: true, spaceBefore: 14 });
    else if (trimmed.startsWith("• ")) lines.push({ text: trimmed, size: 11, bold: false, spaceBefore: 2 });
    else lines.push({ text: trimmed, size: 11, bold: false, spaceBefore: 4 });
  }
  return lines;
}

function wrapText(value: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function generateFormPdf(renderedHtml: string, title: string, memberName: string) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: rgb(31 / 255, 87 / 255, 50 / 255) });
    page.drawText("MAURER EVENTS", { x: margin, y: y - 18, size: 20, font: bold as never, color: rgb(31 / 255, 87 / 255, 50 / 255) });
    page.drawText(title, { x: margin, y: y - 40, size: 10, font: regular, color: rgb(0.38, 0.42, 0.38) });
    y -= 58;
  };
  drawHeader();
  page.drawText(`Ausgefüllt für: ${memberName}`, { x: margin, y: y - 6, size: 10, font: regular, color: rgb(0.45, 0.45, 0.45) });
  y -= 26;

  for (const line of htmlToLines(renderedHtml)) {
    const font = line.bold ? (bold as never) : (regular as never);
    const wrapped = wrapText(line.text, font, line.size, maxWidth);
    for (const [index, text] of wrapped.entries()) {
      if (index === 0) y -= line.spaceBefore;
      if (y < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(text, { x: margin, y, size: line.size, font, color: rgb(0.08, 0.1, 0.08) });
      y -= line.size * 1.4;
    }
  }
  page.drawText(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, {
    x: margin, y: margin - 24 < 20 ? 24 : margin - 24, size: 8, font: regular, color: rgb(0.6, 0.6, 0.6),
  });
  return Buffer.from(await pdfDoc.save());
}

function cloudinarySignature(params: Record<string, string>, secret: string) {
  const base = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return crypto.createHash("sha1").update(`${base}${secret}`).digest("hex");
}

async function uploadPdf(pdf: Buffer, publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary ist nicht konfiguriert.");
  const folder = "maurer-events/staff";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("public_id", publicId);
  body.append("signature", cloudinarySignature({ folder, public_id: publicId, timestamp }, apiSecret));
  // PDFs als "raw" hochladen – sonst blockt Cloudinary die Auslieferung (PDF-Delivery ist per Default aus)
  // und das "Öffnen" endet im Browser mit "destination stream closed early".
  const resUpload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: "POST", body });
  const data = (await resUpload.json().catch(() => null)) as { secure_url?: string; public_id?: string; error?: { message?: string } } | null;
  if (!resUpload.ok || !data?.secure_url) {
    const raw = data?.error?.message || "Upload fehlgeschlagen.";
    if (resUpload.status === 403 || (typeof raw === "string" && raw.includes("missing permissions"))) throw new Error("Upload nicht erlaubt: Der Cloudinary-Schlüssel darf keine Dateien anlegen. Bitte in Cloudinary (Console → Settings → API Keys → Permissions) die Berechtigung Create assets aktivieren.");
    throw new Error(raw);
  }
  return data;
}

export async function activeFormTemplate(kind: string) {
  const [template] = await db.select().from(documentFormTemplates)
    .where(and(eq(documentFormTemplates.kind, kind), eq(documentFormTemplates.status, "active")));
  return template || null;
}

export async function ensureMinijobDocument(staffId: string) {
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
  if (!member) return null;
  const template = await activeFormTemplate("minijob");
  if (!template || !template.bodyHtml.trim()) return null;
  const [role] = member.roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
  const rendered = renderFormTemplate(template.bodyHtml, member, role || null);
  const pdf = await generateFormPdf(rendered, template.name, `${member.firstName} ${member.lastName}`);
  const uploaded = await uploadPdf(pdf, `minijob-${staffId}`);
  const existing = await db.select().from(staffDocuments)
    .where(and(eq(staffDocuments.staffId, staffId), eq(staffDocuments.kind, "minijob_form")));
  if (existing.length > 0) {
    const [updated] = await db.update(staffDocuments).set({
      fileUrl: uploaded.secure_url!,
      publicId: uploaded.public_id || null,
      mimeType: "application/pdf",
      status: "verified",
      note: "Automatisch vorbefüllt aus Onboarding-Daten.",
    }).where(eq(staffDocuments.id, existing[0].id)).returning();
    return updated;
  }
  const [created] = await db.insert(staffDocuments).values({
    staffId,
    kind: "minijob_form",
    fileUrl: uploaded.secure_url!,
    publicId: uploaded.public_id || null,
    mimeType: "application/pdf",
    status: "verified",
    note: "Automatisch vorbefüllt aus Onboarding-Daten.",
  }).returning();
  return created;
}
