import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplates, contracts, staff as staffTable, staffRoles } from "@/db/schema";
import { escapeHtml } from "./escape";

type StaffRow = typeof staffTable.$inferSelect;
type RoleRow = typeof staffRoles.$inferSelect;

export function renderContract(bodyHtml: string, staff: StaffRow, role: RoleRow | null) {
  const values: Record<string, string> = {
    vorname: staff.firstName,
    nachname: staff.lastName,
    name: `${staff.firstName} ${staff.lastName}`,
    adresse: [staff.street, [staff.zip, staff.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    email: staff.email,
    telefon: staff.phone || "",
    rolle: role?.name || "",
    stundensatz: (staff.hourlyRateCents / 100).toFixed(2).replace(".", ","),
    eintritt: staff.entryDate ? new Date(staff.entryDate).toLocaleDateString("de-DE") : "",
    heute: new Date().toLocaleDateString("de-DE"),
  };
  return bodyHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => escapeHtml(values[key] ?? ""));
}

export async function activeTemplateForRole(roleId: string | null) {
  if (!roleId) return null;
  const [template] = await db.select().from(contractTemplates)
    .where(and(eq(contractTemplates.roleId, roleId), eq(contractTemplates.status, "active")))
    .orderBy(desc(contractTemplates.version)).limit(1);
  return template || null;
}

export async function ensureContractForStaff(staffId: string) {
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
  if (!member) return null;
  const [role] = member.roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
  const template = await activeTemplateForRole(member.roleId);
  if (!template) return null;
  const [existing] = await db.select().from(contracts).where(and(
    eq(contracts.staffId, staffId),
    eq(contracts.templateId, template.id),
    eq(contracts.templateVersion, template.version),
  ));
  if (existing) return existing;
  const [created] = await db.insert(contracts).values({
    staffId,
    templateId: template.id,
    templateVersion: template.version,
    roleId: member.roleId,
    bodyHtml: renderContract(template.bodyHtml, member, role || null),
    signatureMode: template.signatureMode,
    consentVersion: "2026-11",
  }).returning();
  return created;
}