import { cookies } from "next/headers";
import { db } from "@/db";
import { redirect } from "next/navigation";
import { assertStaffPermission, staffSession } from './staff-access';

export async function requireStaff(redirectOnFailure = false) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_token")?.value;

  let staff = null;
  try { staff = await staffSession(db, sessionId); }
  catch { console.error('Staff authentication unavailable'); }
  if (!staff) {
    if (redirectOnFailure) {
      redirect("/admin/login");
    } else {
      throw new Error("Unauthorized: Invalid or expired session.");
    }
  }
  return staff;
}

export async function requireAdmin(redirectOnFailure = false) {
  const staff = await requireStaff(redirectOnFailure);
  if (redirectOnFailure && staff.role !== 'admin') redirect('/admin/scan');
  assertStaffPermission(staff, 'admin');
  return staff;
}

export async function requireScanner(eventId?: string, redirectOnFailure = false) {
  const staff = await requireStaff(redirectOnFailure);
  if (redirectOnFailure && staff.role === 'scanner' && eventId && !staff.eventIds.includes(eventId)) redirect('/admin/scan');
  assertStaffPermission(staff, 'scan', eventId);
  return staff;
}
