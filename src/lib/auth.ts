import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/db";
import { redirect } from "next/navigation";
import { assertStaffPermission, staffSession } from './staff-access';
import { getAdminSession } from './admin-session';

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
  // Passkey-first: try new admin session cookie first.
  const cookieStore = await cookies();
  const passkeyToken = cookieStore.get("__Host-adm_session")?.value;
  if (passkeyToken) {
    const sess = await getAdminSession(passkeyToken);
    if (sess) {
      return { email: sess.email, role: 'admin' as const, eventIds: [] as string[] };
    }
  }

  // Legacy-Fallback ist standardmäßig deaktiviert (fail-closed). Nur wenn explizit
  // als Break-Glass aktiviert (Env ADMIN_AUTH_LEGACY_BREAKGLASS=true, in Prod unset),
  // wird der alte admin_token-Pfad akzeptiert; jeder Accept wird auditiert.
  const breakGlass = process.env.ADMIN_AUTH_LEGACY_BREAKGLASS === "true";
  const isDev = process.env.NODE_ENV !== "production";
  const v2DefaultOn = process.env.ADMIN_AUTH_V2 !== "false";
  if (v2DefaultOn && !breakGlass && !isDev) {
    if (redirectOnFailure) redirect("/admin/login");
    throw new Error("Unauthorized: Admin-Passkey-Session erforderlich.");
  }

  if (breakGlass) {
    const { audit } = await import("@/lib/audit");
    const legacyEmail = cookieStore.get("admin_token")?.value || "unknown";
    await audit("system", legacyEmail, "admin.legacy_breakglass_accept", "admin_session", null, { redirectOnFailure });
  }

  const staff = await requireStaff(redirectOnFailure);
  if (redirectOnFailure && staff.role !== 'admin') redirect('/admin/scan');
  assertStaffPermission(staff, 'admin');
  return staff;
}

export async function requireAdminStepUp() {
  const admin = await requireAdmin(false);
  const cookieStore = await cookies();
  const token = cookieStore.get("__Host-adm_session")?.value;
  const sess = token ? await getAdminSession(token) : null;
  if (!sess || !sess.stepUpValid) {
    throw new Error("Unauthorized: Frische TOTP-Bestätigung erforderlich (Step-up).");
  }
  return { ...admin, adminId: sess.adminId, sessionToken: token as string };
}

export async function requireScanner(eventId?: string, redirectOnFailure = false) {
  const staff = await requireStaff(redirectOnFailure);
  if (redirectOnFailure && staff.role === 'scanner' && eventId && !staff.eventIds.includes(eventId)) redirect('/admin/scan');
  assertStaffPermission(staff, 'scan', eventId);
  return staff;
}
