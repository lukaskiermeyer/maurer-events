// Cloudinary-Migration: alt (CLOUDINARY_* splits) -> neu (CLOUDINARY_URL)
// Verwendung: npx tsx scripts/migrate-cloudinary.ts --dry-run
//             npx tsx scripts/migrate-cloudinary.ts --execute
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, like, or } from "drizzle-orm";
import { db } from "../src/db";
import { contracts, eventDocuments, events, galleries, reservations, staffDocuments } from "../src/db/schema";

const DRY = !process.argv.includes("--execute");

type CloudCreds = { cloudName: string; apiKey: string; apiSecret: string };

function parseCloudinaryUrl(url: string): CloudCreds {
  // cloudinary://key:secret@cloud
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error("CLOUDINARY_URL hat falsches Format (erwartet cloudinary://key:secret@cloud)");
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

const oldCreds: CloudCreds = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  apiKey: process.env.CLOUDINARY_API_KEY || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET || "",
};
const newCreds: CloudCreds = process.env.CLOUDINARY_URL ? parseCloudinaryUrl(process.env.CLOUDINARY_URL) : { cloudName: "", apiKey: "", apiSecret: "" };

function basicAuth(c: CloudCreds) { return "Basic " + Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString("base64"); }

async function listResources(c: CloudCreds, prefix = "maurer-events") {
  const all: any[] = [];
  // Admin API: resources/image + resources/raw + resources/video (PDFs können raw sein)
  for (const rt of ["image", "raw", "video"]) {
    let cursor: string | undefined;
    do {
      const qs = new URLSearchParams({ prefix, max_results: "500", ...(cursor ? { next_cursor: cursor } : {}) });
      const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/resources/${rt}?${qs}`, { headers: { Authorization: basicAuth(c) } });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`List ${rt} fehlgeschlagen: ${data?.error?.message || res.status}`);
      all.push(...(data.resources || []));
      cursor = data.next_cursor;
    } while (cursor);
  }
  return all;
}

function sign(params: Record<string, string>, secret: string) {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const base = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(`${base}${secret}`).digest("hex");
}

async function uploadToNew(resource: any) {
  // Original-Datei laden
  const src = resource.secure_url as string;
  const dl = await fetch(src);
  if (!dl.ok) throw new Error(`Download fehlgeschlagen (${dl.status}) für ${resource.public_id}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const resourceType = resource.resource_type || "image";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(buf)], { type: resource.format ? `application/${resource.format}` : "application/octet-stream" }));
  body.append("api_key", newCreds.apiKey);
  body.append("timestamp", timestamp);
  body.append("public_id", resource.public_id);
  body.append("signature", sign({ public_id: resource.public_id, timestamp }, newCreds.apiSecret));
  // overwrite=true falls in neuem Cloud schon vorhanden
  body.append("overwrite", "true");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${newCreds.cloudName}/${resourceType}/upload`, { method: "POST", body });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message || `Upload fehlgeschlagen (${res.status})`);
  return { secureUrl: data.secure_url as string, publicId: data.public_id as string };
}

async function main() {
  console.log(DRY ? "=== DRY-RUN (nichts wird hochgeladen/gespeichert) ===" : "=== EXECUTE: Transfer startet ===");
  if (!oldCreds.cloudName || !oldCreds.apiKey) throw new Error("Alte Cloudinary-Credits fehlen (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY im Split)");
  if (!newCreds.cloudName) throw new Error("Neue Cloudinary-URL fehlt (CLOUDINARY_URL) – bitte in .env.local eintragen");
  console.log(`Alt: ${oldCreds.cloudName} -> Neu: ${newCreds.cloudName}`);

  const resources = await listResources(oldCreds);
  console.log(`Gefunden im alten Cloud: ${resources.length} Assets unter maurer-events/`);
  for (const r of resources) console.log(` - ${r.public_id}.${r.format || "?"} (${r.resource_type})`);

  // DB-URLs sammeln (die noch auf alten Cloud zeigen)
  const oldBase = `res.cloudinary.com/${oldCreds.cloudName}/`;
  const mapping = new Map<string, string>(); // old secureUrl -> new secureUrl
  const counts = { events: 0, galleries: 0, staffDocs: 0, contracts: 0, eventDocs: 0, reservations: 0 };

  if (DRY) {
    console.log("\nDry-Run endet hier. Mit --execute werden Assets übertragen + DB-URLs umgeschrieben.");
    // zeige DB-Betroffenheit
    const ev = await db.select({ id: events.id, imageUrl: events.imageUrl }).from(events).where(or(like(events.imageUrl, `%${oldBase}%`)));
    const ga = await db.select({ id: galleries.id }).from(galleries).where(like(galleries.imageUrl, `%${oldBase}%`));
    const sd = await db.select({ id: staffDocuments.id }).from(staffDocuments).where(like(staffDocuments.fileUrl, `%${oldBase}%`));
    const co = await db.select({ id: contracts.id }).from(contracts).where(like(contracts.signedFileUrl, `%${oldBase}%`));
    const ed = await db.select({ id: eventDocuments.id }).from(eventDocuments).where(like(eventDocuments.fileUrl, `%${oldBase}%`));
    const re = await db.select({ id: reservations.id }).from(reservations).where(like(reservations.pdfUrl, `%${oldBase}%`));
    console.log(`DB-Zeilen mit alter URL: events=${ev.length} galleries=${ga.length} staffDocs=${sd.length} contracts=${co.length} eventDocs=${ed.length} reservations=${re.length}`);
    return;
  }

  for (const r of resources) {
    const { secureUrl } = await uploadToNew(r);
    mapping.set(r.secure_url, secureUrl);
    console.log(`✓ ${r.public_id} -> ${secureUrl}`);
  }

  // DB umschreiben: secure_url exakt ersetzen
  async function rewrite(table: any, urlCol: any, publicIdCol: any, counterKey: keyof typeof counts) {
    const rows = await db.select({ id: (table as any).id, u: urlCol } as any).from(table as any);
    for (const row of rows as any[]) {
      const newUrl = mapping.get(row.u);
      if (newUrl) {
        // publicId ggf. mit Überschreiben (Cloudinary liefert gleiche public_id)
        await db.update(table as any).set({ [urlCol.name]: newUrl }).where(eq((table as any).id, row.id));
        counts[counterKey]++;
      }
    }
  }
  // Vereinfachter Rewrite über SQL-Replace auf allen Tabellen wäre fehleranfällig; daher gezielt:
  const evRows = await db.select().from(events);
  for (const r of evRows) if (r.imageUrl && mapping.get(r.imageUrl)) { await db.update(events).set({ imageUrl: mapping.get(r.imageUrl)! }).where(eq(events.id, r.id)); counts.events++; }
  const gaRows = await db.select().from(galleries);
  for (const r of gaRows) if (mapping.get(r.imageUrl)) { await db.update(galleries).set({ imageUrl: mapping.get(r.imageUrl)! }).where(eq(galleries.id, r.id)); counts.galleries++; }
  const sdRows = await db.select().from(staffDocuments);
  for (const r of sdRows) if (mapping.get(r.fileUrl)) { await db.update(staffDocuments).set({ fileUrl: mapping.get(r.fileUrl)! }).where(eq(staffDocuments.id, r.id)); counts.staffDocs++; }
  const coRows = await db.select().from(contracts);
  for (const r of coRows) if (r.signedFileUrl && mapping.get(r.signedFileUrl)) { await db.update(contracts).set({ signedFileUrl: mapping.get(r.signedFileUrl)! }).where(eq(contracts.id, r.id)); counts.contracts++; }
  const edRows = await db.select().from(eventDocuments);
  for (const r of edRows) if (mapping.get(r.fileUrl)) { await db.update(eventDocuments).set({ fileUrl: mapping.get(r.fileUrl)! }).where(eq(eventDocuments.id, r.id)); counts.eventDocs++; }
  const reRows = await db.select().from(reservations);
  for (const r of reRows) if (r.pdfUrl && mapping.get(r.pdfUrl)) { await db.update(reservations).set({ pdfUrl: mapping.get(r.pdfUrl)! }).where(eq(reservations.id, r.id)); counts.reservations++; }

  console.log("Fertig.", counts);
  console.log("Bitte: neue Env-Werte auf neuen Cloud setzen, Dev-Server neu starten, Bilder/Dokumente testen. Alten Cloud erst als Backup behalten!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
