import { and, eq, inArray, isNotNull, lt, notLike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  contracts,
  customerImports,
  payrollExports,
  staff,
  staffAssignments,
  staffAvailability,
  staffDocuments,
  staffInvites,
  staffSessions,
} from "@/db/schema";
import { STAFF_ANONYMIZE_AFTER_DAYS, STAFF_AUDIT_RETENTION_DAYS, STAFF_ID_DOC_KINDS, STAFF_ID_DOC_RETENTION_DAYS } from "./retention-policy";

export async function runRetentionCleanup(connection = db, now = new Date()) {
  const yearAgo = new Date(now.getTime() - 365 * 86400000);
  const tenYearsAgo = new Date(now.getTime() - STAFF_AUDIT_RETENTION_DAYS * 86400000);
  const idDocCutoff = new Date(now.getTime() - STAFF_ID_DOC_RETENTION_DAYS * 86400000);
  const anonymizeCutoff = new Date(now.getTime() - STAFF_ANONYMIZE_AFTER_DAYS * 86400000);

  // 1) Identitäts-/Gesundheitsdokumente nach Austritt + Frist löschen.
  //    Die Cloudinary-URLs werden zurückgegeben, damit der Aufrufer sie beim
  //    Provider purge kann (Cron-Route); DB-Zeilen verschwinden hier sofort.
  const expiredStaffForDocs = await connection.select({ id: staff.id }).from(staff)
    .where(and(isNotNull(staff.exitDate), lt(staff.exitDate, idDocCutoff)));
  const expiredDocStaffIds = expiredStaffForDocs.map(row => row.id);
  let purgedIdDocs: string[] = [];
  if (expiredDocStaffIds.length > 0) {
    const docs = await connection.select({ id: staffDocuments.id, fileUrl: staffDocuments.fileUrl }).from(staffDocuments)
      .where(and(inArray(staffDocuments.staffId, expiredDocStaffIds), inArray(staffDocuments.kind, [...STAFF_ID_DOC_KINDS])));
    purgedIdDocs = docs.map(doc => doc.fileUrl);
    if (docs.length > 0) {
      await connection.delete(staffDocuments).where(inArray(staffDocuments.id, docs.map(doc => doc.id)));
    }
  }

  // 2) Personalakten nach 10 Jahren anonymisieren + Vertrags-/Dokumenten-PII löschen.
  const anonymizeCandidates = await connection.select({ id: staff.id }).from(staff)
    .where(and(isNotNull(staff.exitDate), lt(staff.exitDate, anonymizeCutoff)));
  // Bereits anonymisiert erkennen (E-Mail enthält deleted-Marker).
  const toAnonymize = anonymizeCandidates.filter(row => !row.id.includes("anonymized"));
  let anonymizedStaff = 0;
  const purgedAnonymizeUrls: string[] = [];
  for (const candidate of toAnonymize) {
    const [member] = await connection.select().from(staff).where(eq(staff.id, candidate.id));
    if (!member) continue;
    // Bereits anonymisiert (Email-Marker) überspringen.
    if (member.email === `anonymized-${member.id}@deleted.invalid`) continue;
    const docs = await connection.select({ fileUrl: staffDocuments.fileUrl }).from(staffDocuments).where(eq(staffDocuments.staffId, member.id));
    const staffContracts = await connection.select({ signedFileUrl: contracts.signedFileUrl }).from(contracts).where(eq(contracts.staffId, member.id));
    purgedAnonymizeUrls.push(...docs.map(doc => doc.fileUrl), ...staffContracts.map(c => c.signedFileUrl).filter((url): url is string => Boolean(url)));
    await connection.delete(staffDocuments).where(eq(staffDocuments.staffId, member.id));
    await connection.delete(contracts).where(eq(contracts.staffId, member.id));
    await connection.delete(staffAvailability).where(eq(staffAvailability.staffId, member.id));
    await connection.delete(staffAssignments).where(eq(staffAssignments.staffId, member.id));
    await connection.delete(staffInvites).where(eq(staffInvites.staffId, member.id));
    await connection.delete(staffSessions).where(eq(staffSessions.staffId, member.id));
    await connection.update(staff).set({
      email: `anonymized-${member.id}@deleted.invalid`,
      firstName: "Anonymisiert",
      lastName: "Anonymisiert",
      phone: null,
      birthDate: null,
      street: null,
      zip: null,
      city: null,
      passwordHash: null,
      taxIdEnc: null,
      taxClass: null,
      childAllowances: 0,
      socialSecurityEnc: null,
      healthInsurance: null,
      ibanEnc: null,
      bic: null,
      hourlyRateCents: 0,
      monthlySalaryCents: 0,
      privacyVersion: null,
      privacyAcceptedAt: null,
      lastLoginAt: null,
      updatedAt: now,
    }).where(eq(staff.id, member.id));
    anonymizedStaff++;
  }

  const [invites, sessions, payroll, imports] = await Promise.all([
    connection.delete(staffInvites).where(lt(staffInvites.expiresAt, now)).returning({ id: staffInvites.id }),
    connection.delete(staffSessions).where(lt(staffSessions.validUntil, now)).returning({ id: staffSessions.id }),
    connection.delete(payrollExports).where(and(isNotNull(payrollExports.usedAt), lt(payrollExports.createdAt, yearAgo))).returning({ id: payrollExports.id }),
    connection.delete(customerImports).where(lt(customerImports.createdAt, yearAgo)).returning({ id: customerImports.id }),
  ]);
  // Audit: allgemeine Einträge nach 1 Jahr, Personal-/Lohn-Audits nach 10 Jahren.
  const [audits] = await Promise.all([
    connection.delete(auditLog).where(and(
      lt(auditLog.createdAt, yearAgo),
      notLike(auditLog.action, "staff.%"),
      notLike(auditLog.action, "payroll.%"),
      notLike(auditLog.action, "contract%"),
    )).returning({ id: auditLog.id }),
  ]);
  const oldStaffAudits = await connection.delete(auditLog).where(and(
    lt(auditLog.createdAt, tenYearsAgo),
    or(
      likeAction("staff.%"),
      likeAction("payroll.%"),
      likeAction("contract%"),
    ),
  )).returning({ id: auditLog.id });

  return {
    staffInvites: invites.length,
    staffSessions: sessions.length,
    payrollExports: payroll.length,
    customerImports: imports.length,
    auditLogs: audits.length + oldStaffAudits.length,
    purgedIdDocUrls: purgedIdDocs,
    purgedAnonymizeUrls,
    anonymizedStaff,
    ninetyDaysAgo: new Date(now.getTime() - 90 * 86400000).toISOString(),
  };
}

function likeAction(pattern: string) {
  return sql`${auditLog.action} like ${pattern}`;
}
