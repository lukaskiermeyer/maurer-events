import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/db";
import { redirect } from "next/navigation";
import { assertStaffPermission, staffSession } from './staff-access';

// Pro Request nur 1× DB prüfen, auch wenn mehrere Server Actions requireAdmin() aufrufen.
// Ohne das greifen 5× parallele Session-Checks ins Timeout, wenn Neon gerade aufwacht.
const sessionForToken = cache(async (sessionId: string | undefined) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await staffSession(db, sessionId);
    } catch (error) {
      if (attempt === 1) {
        console.error('Staff authentication unavailable', { name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
      // Kurzer Retry: Neon-Cold-Start / Connection-Timeout ist meist beim 2. Versuch weg.
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
});

export async function requireStaff(redirectOnFailure = false) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_token")?.value;

  let staff = null;
  try { staff = await sessionForToken(sessionId); }
  catch { /* oben geloggt – als „keine Session" behandeln */ }
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
