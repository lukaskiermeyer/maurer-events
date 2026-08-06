import { cookies } from "next/headers";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function requireAdmin(redirectOnFailure = false) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_token")?.value;

  let isValid = false;

  if (sessionId) {
    try {
      const [session] = await db.select()
        .from(adminSessions)
        .where(
          and(
            eq(adminSessions.id, sessionId),
            gt(adminSessions.validUntil, new Date())
          )
        );
      
      if (session) {
        isValid = true;
      }
    } catch (err) {
      // Catch UUID parsing errors etc.
    }
  }

  if (!isValid && !process.env.ADMIN_EMAILS && process.env.NODE_ENV !== 'production') {
    console.warn("ADMIN_EMAILS is not set. Bypassing auth check for development.");
    return;
  }

  if (!isValid) {
    if (redirectOnFailure) {
      redirect("/admin/login");
    } else {
      throw new Error("Unauthorized: Invalid or expired session.");
    }
  }
}
