"use server";

import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { db } from "@/db";
import { auditLog, contractTemplates, contracts, eventStaffRequirements, shiftOffers, staff, staffAssignments, staffAvailability, staffDocuments, staffInvites, staffRoles, staffSessions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { requireStaffMember, hashToken, randomToken } from "@/lib/staff-auth";
import { BookingError, uuid } from "@/lib/reservation-policy";
import { encryptField } from "@/lib/secure-fields";
import { PRIVACY_VERSION } from "@/lib/privacy-version";
import { bicField, ibanField, taxIdField } from "@/lib/bank-details";
import { emailFrom } from "@/lib/email";
import { ensureContractForStaff } from "@/lib/contracts";
import { ensureMinijobDocument } from "@/lib/document-forms";
import { missingRequiredDocsForStaff } from "@/lib/staff-required-docs";
import { staffInviteHtml, staffInviteSubject, staffInviteText } from "@/lib/staff-invite-email";
import { deleteCloudinaryImage } from "@/lib/cloudinary";

function text(value: unknown, label: string, max: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new BookingError(`${label} ist erforderlich.`);
    return null;
  }
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new BookingError(`Ungültige ${label}.`);
  return value.trim() || null;
}
function email(value: unknown) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BookingError("Ungültige E-Mail-Adresse.");
  return value.trim().toLowerCase();
}
function date(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) throw new BookingError(`Ungültiges ${label}.`);
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new BookingError(`Ungültiges ${label}.`);
  return parsed;
}
function integer(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new BookingError(`Ungültige ${label}.`);
  return value;
}
async function audit(actorType: string, actorId: string, action: string, entityType: string, entityId: string | null, meta?: Record<string, unknown>) {
  await db.insert(auditLog).values({ actorType, actorId, action, entityType, entityId, meta });
}

export async function getStaffList() {
  await requireAdmin();
  return db.select({ member: staff, role: staffRoles }).from(staff)
    .leftJoin(staffRoles, eq(staffRoles.id, staff.roleId))
    .orderBy(asc(staff.lastName), asc(staff.firstName));
}

export async function getStaffDetail(staffId: string) {
  await requireAdmin();
  uuid(staffId);
  const [member] = await db.select({ member: staff, role: staffRoles }).from(staff)
    .leftJoin(staffRoles, eq(staffRoles.id, staff.roleId))
    .where(eq(staff.id, staffId));
  if (!member) return null;
  const [documents, staffContracts] = await Promise.all([
    db.select().from(staffDocuments).where(eq(staffDocuments.staffId, staffId)).orderBy(desc(staffDocuments.createdAt)),
    db.select().from(contracts).where(eq(contracts.staffId, staffId)).orderBy(desc(contracts.createdAt)),
  ]);
  // Datensparsamkeit: keine verschlüsselten Steuer-/IBAN-/SV-Werte und kein
  // Passwort-Hash an die Admin-UI senden (dort nicht benötigt).
  const safeMember = {
    ...member.member,
    passwordHash: null,
    taxIdEnc: null,
    socialSecurityEnc: null,
    ibanEnc: null,
  };
  return { member: safeMember, role: member.role, documents, contracts: staffContracts };
}

export async function getRoles() {
  await requireAdmin();
  return db.select().from(staffRoles).orderBy(asc(staffRoles.name));
}

export async function createRole(data: { key: string; name: string; description?: string; hourlyRateCents?: number; profitSharePercent?: number | null; requiredDocuments?: string[]; requiresHandwrittenSignature?: boolean }) {
  const actor = await requireAdmin();
  const key = text(data.key, "Rollen-Schlüssel", 50, true)!;
  if (!/^[a-z0-9_-]+$/.test(key)) throw new BookingError("Rollen-Schlüssel nur mit Kleinbuchstaben, Zahlen, _ und -.");
  const name = text(data.name, "Rollenname", 100, true)!;
  const [created] = await db.insert(staffRoles).values({
    key, name,
    description: text(data.description, "Beschreibung", 500),
    hourlyRateCents: integer(data.hourlyRateCents ?? 0, 0, 99999999, "Stundensatz"),
    profitSharePercent: data.profitSharePercent === null || data.profitSharePercent === undefined ? null : (typeof data.profitSharePercent === "number" && Number.isFinite(data.profitSharePercent) && data.profitSharePercent >= 0 && data.profitSharePercent <= 100 ? data.profitSharePercent : null),
    requiredDocuments: Array.isArray(data.requiredDocuments) ? data.requiredDocuments.slice(0, 20).map(value => String(value).slice(0, 50)) : [],
    requiresHandwrittenSignature: data.requiresHandwrittenSignature === true,
  }).returning();
  await audit("admin", actor.email, "staff_role.create", "staff_role", created.id);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, role: created };
}

export async function updateRole(roleId: string, data: Partial<{ name: string; description: string | null; hourlyRateCents: number; profitSharePercent: number | null; requiredDocuments: string[]; requiresHandwrittenSignature: boolean; active: boolean }>) {
  const actor = await requireAdmin();
  uuid(roleId);
  const [currentRole] = await db.select().from(staffRoles).where(eq(staffRoles.id, roleId));
  if (!currentRole) throw new BookingError("Rolle nicht gefunden.", 404);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) patch.name = text(data.name, "Rollenname", 100, true);
  if (data.description !== undefined) patch.description = text(data.description, "Beschreibung", 500);
  if (data.hourlyRateCents !== undefined) patch.hourlyRateCents = integer(data.hourlyRateCents, 0, 99999999, "Stundensatz");
  if (data.profitSharePercent !== undefined) patch.profitSharePercent = data.profitSharePercent === null ? null : (typeof data.profitSharePercent === "number" && Number.isFinite(data.profitSharePercent) && data.profitSharePercent >= 0 && data.profitSharePercent <= 100 ? data.profitSharePercent : null);
  if (data.requiredDocuments !== undefined) patch.requiredDocuments = data.requiredDocuments.slice(0, 20).map(value => String(value).slice(0, 50));
  if (data.requiresHandwrittenSignature !== undefined) patch.requiresHandwrittenSignature = data.requiresHandwrittenSignature === true;
  if (data.requiresHandwrittenSignature !== undefined) {
    const newMode = data.requiresHandwrittenSignature === true ? "handwritten" : "text";
    await db.update(contracts).set({ signatureMode: newMode, updatedAt: new Date() }).where(and(eq(contracts.roleId, roleId), eq(contracts.status, "pending")));
  }
  let deactivationWarning: string | undefined;
  if (data.active !== undefined && data.active === false) {
    const [staffCount] = await db.select({ n: sql<number>`count(*)::int` }).from(staff).where(eq(staff.roleId, roleId));
    const [reqCount] = await db.select({ n: sql<number>`count(*)::int` }).from(eventStaffRequirements).where(eq(eventStaffRequirements.roleId, roleId));
    if ((staffCount?.n || 0) > 0 || (reqCount?.n || 0) > 0) {
      deactivationWarning = `Rolle wird deaktiviert, aber ${staffCount?.n || 0} Mitarbeiter und ${reqCount?.n || 0} Schicht-Bedarfe hängen noch daran.`;
    }
  }
  if (data.active !== undefined) patch.active = data.active === true;
  // Rollen-Änderungen an zugehörige Mitarbeiter propagieren (nur wenn nicht individuell überschrieben):
  // Mitarbeiter, deren Wert dem alten Rollenwert entspricht, übernehmen den neuen Wert.
  if (data.hourlyRateCents !== undefined && data.hourlyRateCents !== currentRole.hourlyRateCents) {
    await db.update(staff).set({ hourlyRateCents: data.hourlyRateCents, updatedAt: new Date() })
      .where(and(eq(staff.roleId, roleId), eq(staff.hourlyRateCents, currentRole.hourlyRateCents)));
  }
  if (data.profitSharePercent !== undefined && data.profitSharePercent !== currentRole.profitSharePercent) {
    const newPct = data.profitSharePercent === null ? null : data.profitSharePercent;
    const oldPct = currentRole.profitSharePercent;
    if (oldPct === null) {
      await db.update(staff).set({ profitSharePercent: newPct, updatedAt: new Date() })
        .where(and(eq(staff.roleId, roleId), sql`${staff.profitSharePercent} IS NULL`));
    } else {
      await db.update(staff).set({ profitSharePercent: newPct, updatedAt: new Date() })
        .where(and(eq(staff.roleId, roleId), eq(staff.profitSharePercent, oldPct)));
    }
  }
  const [updated] = await db.update(staffRoles).set(patch).where(eq(staffRoles.id, roleId)).returning();
  if (!updated) throw new BookingError("Rolle nicht gefunden.", 404);
  await audit("admin", actor.email, "staff_role.update", "staff_role", roleId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, role: updated, warning: deactivationWarning };
}

export async function createStaff(data: { email: string; firstName: string; lastName: string; roleId: string; phone?: string }) {
  const actor = await requireAdmin();
  const mail = email(data.email);
  const firstName = text(data.firstName, "Vorname", 100, true)!;
  const lastName = text(data.lastName, "Nachname", 100, true)!;
  const roleId = uuid(data.roleId, "Rolle");
  const [role] = await db.select().from(staffRoles).where(and(eq(staffRoles.id, roleId), eq(staffRoles.active, true)));
  if (!role) throw new BookingError("Rolle nicht gefunden oder inaktiv.", 404);
  const [existing] = await db.select().from(staff).where(sql`lower(trim(${staff.email})) = ${mail}`);
  if (existing) throw new BookingError("Für diese E-Mail existiert bereits ein Mitarbeiter.", 409);
  const [created] = await db.insert(staff).values({
    email: mail, firstName, lastName, roleId,
    phone: text(data.phone, "Telefon", 50),
    hourlyRateCents: role.hourlyRateCents,
    profitSharePercent: role.profitSharePercent,
    status: "invited",
  }).returning();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.insert(staffInvites).values({ staffId: created.id, tokenHash: hashToken(token), expiresAt, createdBy: actor.email });
  const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/team/einladung?token=${encodeURIComponent(token)}`;
const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/team/login`;
  const expiresLabel = expiresAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  let warning: string | undefined;
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: emailFrom(),
        to: [mail],
        subject: staffInviteSubject(role.name),
        html: staffInviteHtml({ firstName, inviteUrl, expiresAt: expiresLabel, roleName: role.name, loginUrl }),
        text: staffInviteText({ firstName, inviteUrl, expiresAt: expiresLabel, roleName: role.name, loginUrl }),
      }, { idempotencyKey: `staff-invite:${created.id}:${token.slice(0, 8)}` });
      if (result.error) warning = "Mitarbeiter angelegt, aber die Einladungsmail konnte nicht gesendet werden.";
    } catch {
      warning = "Mitarbeiter angelegt, aber die Einladungsmail konnte nicht gesendet werden.";
    }
  } else {
    warning = "Mitarbeiter angelegt. E-Mail-Versand ist nicht konfiguriert – Link bitte manuell weitergeben.";
  }
  await audit("admin", actor.email, "staff.create", "staff", created.id, { roleId });
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, staff: created, inviteUrl, warning };
}

export async function resendStaffInvite(staffId: string) {
  const actor = await requireAdmin();
  uuid(staffId);
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  if (!member) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.insert(staffInvites).values({ staffId, tokenHash: hashToken(token), expiresAt, createdBy: actor.email });
  const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/team/einladung?token=${encodeURIComponent(token)}`;
const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/team/login`;
  let warning: string | undefined;
  if (process.env.RESEND_API_KEY) {
    const [role] = member.roleId ? await db.select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
    const expiresLabel = expiresAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: emailFrom(), to: [member.email], subject: staffInviteSubject(role?.name || ""),
        html: staffInviteHtml({ firstName: member.firstName, inviteUrl, expiresAt: expiresLabel, roleName: role?.name, loginUrl }),
        text: staffInviteText({ firstName: member.firstName, inviteUrl, expiresAt: expiresLabel, roleName: role?.name, loginUrl }),
      }, { idempotencyKey: `staff-invite:${staffId}:${token.slice(0, 8)}` });
      if (result.error) warning = "Einladung erstellt, Mailversand fehlgeschlagen.";
    } catch { warning = "Einladung erstellt, Mailversand fehlgeschlagen."; }
  } else warning = "E-Mail-Versand ist nicht konfiguriert – Link bitte manuell weitergeben.";
  await audit("admin", actor.email, "staff.invite_resend", "staff", staffId);
  return { success: true, inviteUrl, warning };
}

export async function updateStaffAdmin(staffId: string, data: Partial<{ firstName: string; lastName: string; phone: string | null; roleId: string; status: string; hourlyRateCents: number; profitSharePercent: number | null; employmentType: string; entryDate: string | null; exitDate: string | null }>) {
  const actor = await requireAdmin();
  uuid(staffId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.firstName !== undefined) patch.firstName = text(data.firstName, "Vorname", 100, true);
  if (data.lastName !== undefined) patch.lastName = text(data.lastName, "Nachname", 100, true);
  if (data.phone !== undefined) patch.phone = text(data.phone, "Telefon", 50);
  if (data.roleId !== undefined) patch.roleId = uuid(data.roleId, "Rolle");
  if (data.status !== undefined) {
    if (!["invited", "onboarding", "ready", "active", "inactive"].includes(data.status)) throw new BookingError("Ungültiger Status.");
    patch.status = data.status;
  }
  if (data.hourlyRateCents !== undefined) patch.hourlyRateCents = integer(data.hourlyRateCents, 0, 99999999, "Stundensatz");
  if (data.profitSharePercent !== undefined) patch.profitSharePercent = data.profitSharePercent === null ? null : (typeof data.profitSharePercent === "number" && Number.isFinite(data.profitSharePercent) && data.profitSharePercent >= 0 && data.profitSharePercent <= 100 ? data.profitSharePercent : null);
  if (data.employmentType !== undefined) {
    if (!["minijob", "short_term", "student", "employed"].includes(data.employmentType)) throw new BookingError("Ungültige Beschäftigungsart.");
    patch.employmentType = data.employmentType;
  }
  if (data.entryDate !== undefined) patch.entryDate = date(data.entryDate, "Eintrittsdatum");
  if (data.exitDate !== undefined) patch.exitDate = date(data.exitDate, "Austrittsdatum");
  // Plausibilität: Austritt nicht vor Eintritt (wenn beides bekannt ist).
  const [current] = await db.select({ entryDate: staff.entryDate, exitDate: staff.exitDate }).from(staff).where(eq(staff.id, staffId));
  if (!current) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  const effectiveEntry = patch.entryDate !== undefined ? (patch.entryDate as Date | null) : current.entryDate;
  const effectiveExit = patch.exitDate !== undefined ? (patch.exitDate as Date | null) : current.exitDate;
  if (effectiveEntry && effectiveExit && effectiveExit < effectiveEntry) throw new BookingError("Austrittsdatum liegt vor dem Eintrittsdatum.");
  if (patch.status === "inactive") {
    // Sofortige Sitzungs-Sperrung beim Inaktivsetzen (Art. 32 TOM).
    await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
  }
  const [updated] = await db.update(staff).set(patch).where(eq(staff.id, staffId)).returning();
  if (!updated) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  await audit("admin", actor.email, "staff.update", "staff", staffId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, staff: updated };
}

export async function getStaffErasureStatus(staffId: string) {
  await requireAdmin();
  uuid(staffId);
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  if (!member) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  const isAnonymized = member.email === `anonymized-${member.id}@deleted.invalid`;
  const signedContracts = await db.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.staffId, staffId)));
  const hasTaxData = Boolean(member.taxIdEnc || member.ibanEnc || member.socialSecurityEnc || signedContracts.length > 0);
  // 10 Jahre nach Austritt (§§147 AO, 257 HGB). Ohne Austritt keine Frist berechenbar.
  const retentionUntil = member.exitDate ? new Date(member.exitDate.getTime() + 3650 * 86400000) : null;
  const retentionActive = hasTaxData && (!retentionUntil || retentionUntil > new Date());
  return {
    isAnonymized,
    hasTaxData,
    exitDate: member.exitDate ? member.exitDate.toISOString().slice(0, 10) : null,
    retentionUntil: retentionUntil ? retentionUntil.toISOString().slice(0, 10) : null,
    retentionActive,
    canFullyAnonymize: !isAnonymized && !retentionActive,
    deletableNow: ["Ausweis-/Gesundheits-Dokumente", "Verfügbarkeit & Schichten", "Einladungen & Sitzungen"],
    mustRetain: retentionActive ? ["Lohn-/Steuerdaten (Steuer-ID, IBAN, SV-Nummer)", "Unterschriebene Verträge"] : [],
  };
}

export async function anonymizeStaffForErasure(staffId: string) {
  const actor = await requireAdmin();
  uuid(staffId);
  const status = await getStaffErasureStatus(staffId);
  if (status.isAnonymized) throw new BookingError("Bereits anonymisiert.", 409);
  if (status.retentionActive) {
    throw new BookingError(`Lohn-/Steuerdaten müssen noch aufbewahrt werden (bis ${status.retentionUntil || "unbekannt – Austrittsdatum fehlt"} nach §§ 147 AO, 257 HGB). Es wurden nur die löschbaren Daten entfernt.`, 409);
  }
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  if (!member) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  const docs = await db.select({ fileUrl: staffDocuments.fileUrl }).from(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  const staffContracts = await db.select({ signedFileUrl: contracts.signedFileUrl }).from(contracts).where(eq(contracts.staffId, staffId));
  await db.delete(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  await db.delete(contracts).where(eq(contracts.staffId, staffId));
  await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staffId));
  await db.delete(staffAssignments).where(eq(staffAssignments.staffId, staffId));
  await db.delete(staffInvites).where(eq(staffInvites.staffId, staffId));
  await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
  await db.update(staff).set({
    email: `anonymized-${member.id}@deleted.invalid`,
    firstName: "Anonymisiert", lastName: "Anonymisiert",
    phone: null, birthDate: null, street: null, houseNumber: null, zip: null, city: null,
    passwordHash: null, taxIdEnc: null, taxClass: null, childAllowances: 0,
    socialSecurityEnc: null, healthInsurance: null, ibanEnc: null, bic: null,
    hourlyRateCents: 0, monthlySalaryCents: 0, privacyVersion: null, privacyAcceptedAt: null,
    lastLoginAt: null, status: "inactive", updatedAt: new Date(),
  }).where(eq(staff.id, staffId));
  // Cloudinary purge best effort (Dateien weg)
  for (const url of [...docs.map(d => d.fileUrl), ...staffContracts.map(c => c.signedFileUrl).filter((u): u is string => Boolean(u))]) {
    try { await deleteCloudinaryImage(url); } catch { /* best effort */ }
  }
  await audit("admin", actor.email, "staff.erasure", "staff", staffId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}

export async function eraseDeletableStaffData(staffId: string) {
  // Läuft auch während Aufbewahrung: nur die sofort löschbaren Daten (ohne Lohn/Steuer/Verträge).
  const actor = await requireAdmin();
  uuid(staffId);
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
  if (!member) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  // Idempotency: wenn bereits anonymisiert, nichts zu tun
  if (member.email === `anonymized-${member.id}@deleted.invalid`) throw new BookingError("Bereits anonymisiert.", 409);
  const docs = await db.select({ fileUrl: staffDocuments.fileUrl }).from(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  await db.delete(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staffId));
  await db.delete(staffAssignments).where(eq(staffAssignments.staffId, staffId));
  await db.delete(staffInvites).where(eq(staffInvites.staffId, staffId));
  await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
  for (const url of docs.map(d => d.fileUrl)) { try { await deleteCloudinaryImage(url); } catch { /* best effort */ } }
  await audit("admin", actor.email, "staff.partial_erasure", "staff", staffId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}

function assertDevOnly() {
  // Nur für lokalen Testmüll – in Produktion wird der Button nicht gerendert UND die Action wirft.
  if (process.env.NODE_ENV !== "development") throw new BookingError("Nur in Entwicklung verfügbar.", 403);
}

export async function deleteStaffHardDev(staffId: string) {
  const actor = await requireAdmin();
  assertDevOnly();
  uuid(staffId);
  // FKs in staff-* nutzen onDelete cascade → Verträge, Dokumente, Einladungen, Sitzungen, Schichten verschwinden mit.
  // Cloudinary-Dateien (Dokumente/Verträge) best effort purgen.
  const docs = await db.select({ fileUrl: staffDocuments.fileUrl }).from(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  const staffContracts = await db.select({ signedFileUrl: contracts.signedFileUrl }).from(contracts).where(eq(contracts.staffId, staffId));
  const [deleted] = await db.delete(staff).where(eq(staff.id, staffId)).returning();
  if (!deleted) throw new BookingError("Mitarbeiter nicht gefunden.", 404);
  for (const url of [...docs.map(d => d.fileUrl), ...staffContracts.map(c => c.signedFileUrl).filter((u): u is string => Boolean(u))]) {
    try { await deleteCloudinaryImage(url); } catch { /* best effort */ }
  }
  await audit("admin", actor.email, "staff.hard_delete_dev", "staff", staffId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}

export async function deleteRoleHardDev(roleId: string) {
  const actor = await requireAdmin();
  assertDevOnly();
  uuid(roleId);
  // staff.* und Verträge nutzen set null → Mitarbeiter bleiben, Rolle wird null (nur für Testmüll ok).
  await db.delete(eventStaffRequirements).where(eq(eventStaffRequirements.roleId, roleId));
  await db.delete(staffAssignments).where(eq(staffAssignments.roleId, roleId));
  await db.delete(shiftOffers).where(eq(shiftOffers.roleId, roleId));
  const [deleted] = await db.delete(staffRoles).where(eq(staffRoles.id, roleId)).returning();
  if (!deleted) throw new BookingError("Rolle nicht gefunden.", 404);
  await audit("admin", actor.email, "staff_role.hard_delete_dev", "staff_role", roleId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}

export async function saveMyOnboarding(data: {
  firstName: string; lastName: string; phone?: string; birthDate?: string; street?: string; houseNumber?: string; zip?: string; city?: string;
  employmentType?: string; taxId?: string; taxClass?: string; childAllowances?: number; socialSecurity?: string;
  healthInsurance?: string; iban?: string; bic?: string; entryDate?: string; privacyVersion?: string;
}) {
  const member = await requireStaffMember();
  if (data.privacyVersion !== PRIVACY_VERSION) throw new BookingError("Bitte bestätige die aktuelle Datenschutzerklärung.");
  const employmentType = "short_term";
  if (!["short_term"].includes(employmentType)) throw new BookingError("Ungültige Beschäftigungsart.");
  // Validiere vor dem Encryption-Schreibpfad, damit ungültige Werte nie ankommen.
  const iban = ibanField(data.iban);
  const bic = bicField(data.bic);
  const taxId = taxIdField(data.taxId);
  const [updated] = await db.update(staff).set({
    firstName: text(data.firstName, "Vorname", 100, true)!,
    lastName: text(data.lastName, "Nachname", 100, true)!,
    phone: text(data.phone, "Telefon", 50),
    birthDate: date(data.birthDate, "Geburtsdatum"),
    street: text(data.street, "Straße", 150),
    houseNumber: text(data.houseNumber, "Hausnummer", 20),
    zip: text(data.zip, "PLZ", 20),
    city: text(data.city, "Ort", 100),
    employmentType,
    taxIdEnc: encryptField(taxId),
    taxClass: text(data.taxClass, "Steuerklasse", 10),
    childAllowances: integer(data.childAllowances ?? member.childAllowances, 0, 20, "Kinderfreibeträge"),
    socialSecurityEnc: encryptField(text(data.socialSecurity, "Sozialversicherungsnummer", 50)),
    healthInsurance: text(data.healthInsurance, "Krankenkasse", 150),
    ibanEnc: encryptField(iban),
    bic,
    entryDate: date(data.entryDate, "Eintrittsdatum"),
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: new Date(),
    status: member.status === "invited" ? "onboarding" : member.status,
    updatedAt: new Date(),
  }).where(eq(staff.id, member.id)).returning();
  const contract = await ensureContractForStaff(member.id);
  let document: Awaited<ReturnType<typeof ensureMinijobDocument>> = null;
  let documentWarning: string | undefined;
  try {
    document = await ensureMinijobDocument(member.id);
  } catch {
    documentWarning = "Daten gespeichert, aber das Minijob-Formular konnte nicht automatisch erstellt werden. Bitte wende dich an den Festwirt.";
  }
  await audit("staff", member.id, "staff.onboarding.save", "staff", member.id);
  return { success: true, staff: updated, contract, document, documentWarning };
}

export async function updateMyProfile(data: { firstName?: string; lastName?: string; phone?: string | null; street?: string | null; houseNumber?: string | null; zip?: string | null; city?: string | null; iban?: string | null; bic?: string | null; taxClass?: string | null; healthInsurance?: string | null }) {
  const member = await requireStaffMember();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.firstName !== undefined) patch.firstName = text(data.firstName, "Vorname", 100, true);
  if (data.lastName !== undefined) patch.lastName = text(data.lastName, "Nachname", 100, true);
  if (data.phone !== undefined) patch.phone = text(data.phone, "Telefon", 50);
  if (data.street !== undefined) patch.street = text(data.street, "Straße", 150);
  if (data.houseNumber !== undefined) patch.houseNumber = text(data.houseNumber, "Hausnummer", 20);
  if (data.zip !== undefined) patch.zip = text(data.zip, "PLZ", 20);
  if (data.city !== undefined) patch.city = text(data.city, "Ort", 100);
  if (data.taxClass !== undefined) patch.taxClass = text(data.taxClass, "Steuerklasse", 10);
  if (data.healthInsurance !== undefined) patch.healthInsurance = text(data.healthInsurance, "Krankenkasse", 150);
  if (data.iban !== undefined) patch.ibanEnc = encryptField(ibanField(data.iban));
  if (data.bic !== undefined) patch.bic = bicField(data.bic);
  const [updated] = await db.update(staff).set(patch).where(eq(staff.id, member.id)).returning();
  await audit("staff", member.id, "staff.profile.update", "staff", member.id);
  revalidatePath("/[locale]/team", "layout");
  return { success: true, staff: updated };
}
export async function getMyProfile() {
  const member = await requireStaffMember(true);
  const [role] = member.roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
  const [documents, myContracts] = await Promise.all([
    db.select().from(staffDocuments).where(eq(staffDocuments.staffId, member.id)).orderBy(desc(staffDocuments.createdAt)),
    db.select().from(contracts).where(eq(contracts.staffId, member.id)).orderBy(desc(contracts.createdAt)),
  ]);
  return { member, role: role || null, documents, contracts: myContracts };
}

export async function getMyContract() {
  const member = await requireStaffMember(true);
  const contract = await ensureContractForStaff(member.id);
  const [role] = member.roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, member.roleId)) : [];
  const missingDocs = await missingRequiredDocsForStaff(member.id, role?.requiredDocuments ?? []);
  return { member, role: role || null, contract, missingDocs };
}

export async function verifyStaffDocument(documentId: string, status: "verified" | "rejected") {
  const actor = await requireAdmin();
  uuid(documentId);
  const [updated] = await db.update(staffDocuments).set({ status, verifiedBy: actor.email, verifiedAt: new Date() }).where(eq(staffDocuments.id, documentId)).returning();
  if (!updated) throw new BookingError("Dokument nicht gefunden.", 404);
  await audit("admin", actor.email, `staff_document.${status}`, "staff_document", documentId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}

export async function getContractTemplates() {
  await requireAdmin();
  return db.select({ template: contractTemplates, role: staffRoles }).from(contractTemplates)
    .leftJoin(staffRoles, eq(staffRoles.id, contractTemplates.roleId))
    .orderBy(desc(contractTemplates.createdAt));
}

export async function saveContractTemplate(data: { roleId: string; name: string; bodyHtml: string; signatureMode?: "text" | "handwritten"; status: "draft" | "reviewed" | "active" }) {
  const actor = await requireAdmin();
  const roleId = uuid(data.roleId, "Rolle");
  const name = text(data.name, "Vertragsname", 150, true)!;
  if (typeof data.bodyHtml !== "string" || data.bodyHtml.length < 20 || data.bodyHtml.length > 100000) throw new BookingError("Vertragstext ist ungültig.");
  if (!["draft", "reviewed", "active"].includes(data.status)) throw new BookingError("Ungültiger Status.");
  const [role] = await db.select().from(staffRoles).where(eq(staffRoles.id, roleId));
  const signatureMode = role?.requiresHandwrittenSignature ? "handwritten" : "text";
  const [latest] = await db.select({ version: contractTemplates.version }).from(contractTemplates)
    .where(eq(contractTemplates.roleId, roleId)).orderBy(desc(contractTemplates.version)).limit(1);
  const [created] = await db.insert(contractTemplates).values({
    roleId, name, bodyHtml: data.bodyHtml, signatureMode,
    status: data.status, version: (latest?.version || 0) + 1, createdBy: actor.email,
  }).returning();
  if (data.status === "active") {
    await db.update(contractTemplates).set({ status: "reviewed" }).where(and(
      eq(contractTemplates.roleId, roleId),
      eq(contractTemplates.status, "active"),
      ne(contractTemplates.id, created.id),
    ));
  }
  await audit("admin", actor.email, "contract_template.create", "contract_template", created.id, { version: created.version });
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true, template: created };
}

export async function deleteContractTemplate(templateId: string) {
  const actor = await requireAdmin();
  uuid(templateId);
  // contracts.templateId nutzt FK onDelete set null – bereits erstellte Verträge bleiben erhalten.
  const [deleted] = await db.delete(contractTemplates).where(eq(contractTemplates.id, templateId)).returning();
  if (!deleted) throw new BookingError("Vertragsvorlage nicht gefunden.", 404);
  await audit("admin", actor.email, "contract_template.delete", "contract_template", templateId, { name: deleted.name, version: deleted.version, status: deleted.status });
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}
export async function deleteMyDocument(documentId: string) {
  const member = await requireStaffMember();
  uuid(documentId);
  const [doc] = await db.select().from(staffDocuments).where(and(eq(staffDocuments.id, documentId), eq(staffDocuments.staffId, member.id)));
  if (!doc) throw new BookingError("Dokument nicht gefunden.", 404);
  if (doc.kind === "minijob_form") throw new BookingError("Minijob-Formulare werden automatisch verwaltet.", 403);
  await db.delete(staffDocuments).where(eq(staffDocuments.id, documentId));
  try { await deleteCloudinaryImage(doc.fileUrl); } catch { /* best effort */ }
  revalidatePath("/[locale]/team", "layout");
  return { success: true };
}
