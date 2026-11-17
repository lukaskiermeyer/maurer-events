import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { payrollExports, staff, staffRoles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildPayrollCsv, payrollRow } from "@/lib/payroll";
import { sha256 } from "@/lib/secure-fields";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staffActor = await requireAdmin();
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!token) return new Response("Ungültiger Download-Link.", { status: 400 });
    const [record] = await db.update(payrollExports).set({ usedAt: new Date() }).where(and(
      eq(payrollExports.tokenHash, sha256(token)),
      isNull(payrollExports.usedAt),
      gt(payrollExports.expiresAt, new Date()),
    )).returning();
    if (!record) return new Response("Der Download-Link ist abgelaufen oder wurde bereits verwendet.", { status: 410 });

    const selectedIds = (record.selectedStaffIds as string[] | null) || null;
    const baseQuery = db.select({ member: staff, role: staffRoles }).from(staff)
      .leftJoin(staffRoles, eq(staffRoles.id, staff.roleId))
      .where(and(isNull(staff.exitDate), inArray(staff.status, ["onboarding", "ready", "active"])))
      .orderBy(asc(staff.lastName), asc(staff.firstName));
    const allMembers = await baseQuery;
    const members = selectedIds && selectedIds.length > 0
      ? allMembers.filter(({ member }) => selectedIds.includes(member.id))
      : allMembers;
    const csv = buildPayrollCsv(members.map(({ member, role }) => payrollRow(member, role || null)));
    await audit("admin", staffActor.email, "payroll.export.download", "payroll_export", record.id, { rowCount: members.length });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="DATEV_Lohn_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return new Response("Nicht autorisiert.", { status: 401 });
  }
}