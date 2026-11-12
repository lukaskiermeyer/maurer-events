"use server";

import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { payrollExports, staff, staffRoles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildPayrollCsv, missingPayrollFields, payrollRow } from "@/lib/payroll";
import { sha256 } from "@/lib/secure-fields";

async function payrollMembers() {
  return db.select({ member: staff, role: staffRoles }).from(staff)
    .leftJoin(staffRoles, eq(staffRoles.id, staff.roleId))
    .where(and(isNull(staff.exitDate), inArray(staff.status, ["onboarding", "ready", "active"])))
    .orderBy(asc(staff.lastName), asc(staff.firstName));
}

export async function getPayrollStatus() {
  await requireAdmin();
  const members = await payrollMembers();
  return members.map(({ member, role }) => ({
    id: member.id,
    name: `${member.firstName} ${member.lastName}`,
    role: role?.name || "—",
    status: member.status,
    missing: missingPayrollFields(member),
  }));
}

export async function createPayrollExport() {
  const actor = await requireAdmin();
  const members = await payrollMembers();
  const missing = members
    .map(({ member }) => ({ name: `${member.firstName} ${member.lastName}`, fields: missingPayrollFields(member) }))
    .filter(entry => entry.fields.length > 0);
  if (missing.length > 0) return { success: false, missing };
  if (members.length === 0) return { success: false, missing: [], error: "Keine exportierbaren Mitarbeiter." };

  const csv = buildPayrollCsv(members.map(({ member, role }) => payrollRow(member, role || null)));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60000);
  const [record] = await db.insert(payrollExports).values({
    createdBy: actor.email,
    format: "datev_csv",
    rowCount: members.length,
    fileHash: sha256(csv),
    tokenHash: sha256(token),
    expiresAt,
  }).returning();
  await audit("admin", actor.email, "payroll.export.create", "payroll_export", record.id, { rowCount: members.length });
  return {
    success: true,
    url: `/api/admin/payroll-export?token=${encodeURIComponent(token)}`,
    rowCount: members.length,
    expiresAt: expiresAt.toISOString(),
  };
}