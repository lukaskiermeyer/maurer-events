import { cookies } from "next/headers";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { UUID_PATTERN } from './reservation-policy';
import { isAdminEmail } from './admin-identity';

export async function requireAdmin(redirectOnFailure = false) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_token")?.value;

  let isValid = false;

  if (sessionId && UUID_PATTERN.test(sessionId)) {
    try {
      const [session] = await db.select()
        .from(adminSessions)
        .where(
          and(
            eq(adminSessions.id, sessionId),
            gt(adminSessions.validUntil, new Date())
          )
        );
      
      if (session && isAdminEmail(session.email)) {
        isValid = true;
      }
    } catch (err) {
      console.error("Auth check database error:", err);
      // Fail closed: isValid remains false
    }
  }

  if (!isValid) {
    if (redirectOnFailure) {
      redirect("/admin/login");
    } else {
      throw new Error("Unauthorized: Invalid or expired session.");
    }
  }
}
