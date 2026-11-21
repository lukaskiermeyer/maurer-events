import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staffDocuments } from "@/db/schema";
import { activeFormTemplate } from "./document-forms";
import { missingRequiredDocLabels } from "./required-documents";

// Labels der Pflichtdokumente der Rolle, die noch fehlen oder abgelehnt sind.
// Serverseitig genutzt für die Upload-Checkliste und die Signatur-Sperre.
export async function missingRequiredDocsForStaff(staffId: string, requiredDocuments: string[]): Promise<string[]> {
  if (requiredDocuments.length === 0) return [];
  const [documents, minijobTemplate] = await Promise.all([
    db.select({ kind: staffDocuments.kind, status: staffDocuments.status }).from(staffDocuments).where(eq(staffDocuments.staffId, staffId)),
    activeFormTemplate("minijob"),
  ]);
  return missingRequiredDocLabels(requiredDocuments, documents, { minijobTemplateActive: !!minijobTemplate });
}
