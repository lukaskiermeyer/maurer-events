"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documentFormTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { requireStaffMember } from "@/lib/staff-auth";
import { activeFormTemplate, renderFormTemplate } from "@/lib/document-forms";
import { staffRoles } from "@/db/schema";
import { BookingError, uuid } from "@/lib/reservation-policy";

export async function getMyMinijobPreview() {
  const member = await requireStaffMember();
  const template = await activeFormTemplate("minijob");
  if (!template) return null;
  const [role] = member.roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
  return { name: template.name, bodyHtml: renderFormTemplate(template.bodyHtml, member, role || null) };
}

export async function getDocumentTemplates() {
  await requireAdmin();
  return db.select().from(documentFormTemplates).orderBy(desc(documentFormTemplates.createdAt));
}

export async function saveDocumentTemplate(data: { id?: string; name: string; kind?: string; bodyHtml: string; status: string }) {
  const actor = await requireAdmin();
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  if (!name || name.length > 150) throw new BookingError("Name ist ungültig.");
  if (typeof data?.bodyHtml !== "string" || data.bodyHtml.length < 20 || data.bodyHtml.length > 100000) {
    throw new BookingError("Formulartext ist ungültig (mindestens 20 Zeichen).");
  }
  if (!["draft", "active"].includes(data.status)) throw new BookingError("Ungültiger Status.");
  const kind = data.kind || "minijob";
  if (!["minijob", "other"].includes(kind)) throw new BookingError("Ungültige Formularart.");

  let created;
  if (data.id) {
    uuid(data.id);
    const [updated] = await db.update(documentFormTemplates).set({
      name, kind, bodyHtml: data.bodyHtml, status: data.status, updatedAt: new Date(),
    }).where(eq(documentFormTemplates.id, data.id)).returning();
    if (!updated) throw new BookingError("Formular nicht gefunden.", 404);
    created = updated;
  } else {
    const [inserted] = await db.insert(documentFormTemplates).values({
      name, kind, bodyHtml: data.bodyHtml, status: data.status, createdBy: actor.email,
    }).returning();
    created = inserted;
  }
  if (data.status === "active") {
    await db.update(documentFormTemplates).set({ status: "draft", updatedAt: new Date() })
      .where(and(eq(documentFormTemplates.kind, kind), eq(documentFormTemplates.status, "active"), ne(documentFormTemplates.id, created.id)));
  }
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, template: created };
}

export async function deleteDocumentTemplate(id: string) {
  await requireAdmin();
  uuid(id);
  await db.delete(documentFormTemplates).where(eq(documentFormTemplates.id, id));
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}
