"use server";

import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { payrollExports, staff, staffAssignments, staffRoles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildPayrollCsv, missingPayrollFields, payrollRow } from "@/lib/payroll";
import { sha256 } from "@/lib/secure-fields";

type PayrollMember = { member: typeof staff.$inferSelect; role: typeof staffRoles.$inferSelect | null; assignedEventIds: string[] };

async function payrollMembers(): Promise<PayrollMember[]> {
  const members = await db.select({ member: staff, role: staffRoles }).from(staff)
    .leftJoin(staffRoles, eq(staffRoles.id, staff.roleId))
    .where(and(isNull(staff.exitDate), inArray(staff.status, ["onboarding", "ready", "active"])))
    .orderBy(asc(staff.lastName), asc(staff.firstName));

  const ids = members.map(({ member }) => member.id);
  const assignments = ids.length === 0
    ? []
    : await db.select({ staffId: staffAssignments.staffId, eventId: staffAssignments.eventId }).from(staffAssignments)
      .where(inArray(staffAssignments.staffId, ids));

  const byStaff = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    if (!byStaff.has(assignment.staffId)) byStaff.set(assignment.staffId, new Set());
    byStaff.get(assignment.staffId)!.add(assignment.eventId);
  }

  return members.map(({ member, role }) => ({
    member,
    role,
    assignedEventIds: Array.from(byStaff.get(member.id) || []),
  }));
}

export async function getPayrollStatus() {
  await requireAdmin();
  const members = await payrollMembers();
  return members.map(({ member, role, assignedEventIds }) => ({
    id: member.id,
    name: `${member.firstName} ${member.lastName}`,
    role: role?.name || "—",
    roleId: member.roleId,
    status: member.status,
    employmentType: member.employmentType,
    missing: missingPayrollFields(member),
    assignedEventIds,
  }));
}

export async function createPayrollExport(selectedIds?: string[]) {
  const actor = await requireAdmin();
  const allMembers = await payrollMembers();

  let members = allMembers;
  if (Array.isArray(selectedIds)) {
    if (selectedIds.length === 0) {
      return { success: false as const, missing: [], error: "Keine Mitarbeiter ausgewählt." };
    }
    const selected = new Set(selectedIds);
    members = allMembers.filter(({ member }) => selected.has(member.id));
  }

  const missing = members
    .map(({ member }) => ({ name: `${member.firstName} ${member.lastName}`, fields: missingPayrollFields(member) }))
    .filter(entry => entry.fields.length > 0);
  if (missing.length > 0) return { success: false, missing };
  if (members.length === 0) return { success: false, missing: [], error: "Keine exportierbaren Mitarbeiter." };

  const csv = buildPayrollCsv(members.map(({ member, role }) => payrollRow(member, role || null)));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60000);
  const selectedStaffIds = Array.isArray(selectedIds) ? selectedIds : allMembers.map(({ member }) => member.id);
  const [record] = await db.insert(payrollExports).values({
    createdBy: actor.email,
    format: "datev_csv",
    rowCount: members.length,
    selectedStaffIds,
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