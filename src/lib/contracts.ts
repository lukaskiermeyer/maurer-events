import { and, eq, desc, ne } from "drizzle-orm";
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
    gewinnbeteiligung: (staff.profitSharePercent ?? role?.profitSharePercent ?? 0).toString().replace(".", ","),
    eintritt: staff.entryDate ? new Date(staff.entryDate).toLocaleDateString("de-DE") : "",
    heute: new Date().toLocaleDateString("de-DE"),
  };
  // Conditional blocks: {{#if key}}...{{/if}} (and {{#unless key}}...{{/unless}})
  // are included only based on whether the corresponding value is truthy/non-zero.
  const isTruthy = (v: string | undefined) => {
    if (v === undefined || v === null || v === "") return false;
    const n = v.replace(",", ".");
    if (n === "0" || n === "0.0" || n === "0.00") return false;
    return true;
  };
  let result = bodyHtml.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/gi, (_, key, content) =>
    isTruthy(values[key]) ? content : ""
  );
  result = result.replace(/\{\{#unless\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/unless\}\}/gi, (_, key, content) =>
    isTruthy(values[key]) ? "" : content
  );
  // {{ort}} wird nicht auto-gefüllt: leere Ausfüllzeile für manuelle Eingabe (Ort, Datum).
  const withOrt = result.replace(/\{\{\s*ort\s*\}\}/gi, '<span style="display:inline-block;border-bottom:1px solid #000;min-width:120px">&nbsp;</span>');
  return withOrt.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => escapeHtml(values[key] ?? ""));
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
  // Bestehende Verträge mit noch nicht verarbeiteten Conditional-Markern ({{#if ...}})
  // neu rendern, damit Stundensatz/Umsatzbeteiligung korrekt ein-/ausgeblendet werden.
  if (existing && /\{\{#/.test(existing.bodyHtml)) {
    await db.delete(contracts).where(eq(contracts.id, existing.id));
  } else if (existing) {
    return existing;
  }
  try {
    const [created] = await db.insert(contracts).values({
      staffId,
      templateId: template.id,
      templateVersion: template.version,
      roleId: member.roleId,
      bodyHtml: renderContract(template.bodyHtml, member, role || null),
      signatureMode: template.signatureMode,
      consentVersion: "2026-11",
    }).returning();
    // Alte pending-Vertraege desselben Mitarbeiters als superseded markieren
    await db.update(contracts).set({ status: "declined", updatedAt: new Date() }).where(and(
      eq(contracts.staffId, staffId),
      eq(contracts.status, "pending"),
      ne(contracts.id, created.id),
    ));
    return created;
  } catch {
    // Race: another request created it concurrently – re-select
    const [again] = await db.select().from(contracts).where(and(
      eq(contracts.staffId, staffId),
      eq(contracts.templateId, template.id),
      eq(contracts.templateVersion, template.version),
    ));
    return again || null;
  }
}