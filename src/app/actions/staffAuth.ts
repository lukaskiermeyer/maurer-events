"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { staff, staffInvites } from "@/db/schema";
import { createStaffSession, hashPassword, hashToken, setStaffCookie, clearStaffCookie, verifyPassword } from "@/lib/staff-auth";
import { takeRateLimit } from "@/lib/rate-limit";

async function inviteClientKey(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const forwarded = (requestHeaders.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100);
    return forwarded || "unknown";
  } catch {
    return "unknown";
  }
}

export async function acceptStaffInvite(data: { token: string; password: string }) {
  try {
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (!token || token.length > 200) throw new Error("Ungültiger Einladungslink.");
    const tokenHash = hashToken(token);
    // Rate-Limits VOR DB-Lookup und scrypt-Hashing (CPU-Schutz + Enumerationsschutz).
    // IP-Schicht stoppt Raten über viele Token, Token-Schicht stoppt Hämmern eines Tokens
    // auch bei IP-Rotation/Spoofing.
    const client = await inviteClientKey();
    if (!await takeRateLimit(`staff-invite-ip:${client}`, 10, 15 * 60000)) return { success: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
    if (!await takeRateLimit(`staff-invite:${tokenHash}`, 5, 15 * 60000)) return { success: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.tokenHash, tokenHash));
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new Error("Der Einladungslink ist ungültig oder abgelaufen.");
    const passwordHash = await hashPassword(data.password);
    const [claimed] = await db.update(staffInvites).set({ usedAt: new Date() }).where(and(
      eq(staffInvites.id, invite.id), isNull(staffInvites.usedAt), gt(staffInvites.expiresAt, new Date()),
    )).returning();
    if (!claimed) throw new Error("Der Einladungslink wurde bereits verwendet.");
    await db.update(staff).set({ passwordHash, status: "onboarding", updatedAt: new Date() }).where(eq(staff.id, invite.staffId));
    const session = await createStaffSession(invite.staffId);
    await setStaffCookie(session.id, session.validUntil);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Einladung konnte nicht angenommen werden." };
  }
}

export async function staffLogin(data: { email: string; password: string }) {
  try {
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ungültige E-Mail-Adresse.");
    if (!await takeRateLimit(`staff-login:${email}`, 5, 15 * 60000)) return { success: false, error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." };
    const [member] = await db.select().from(staff).where(sql`lower(trim(${staff.email})) = ${email}`);
    if (!member || member.status === "inactive" || !await verifyPassword(data.password, member.passwordHash)) {
      return { success: false, error: "E-Mail oder Passwort ist falsch." };
    }
    const session = await createStaffSession(member.id);
    await setStaffCookie(session.id, session.validUntil);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Anmeldung fehlgeschlagen." };
  }
}

export async function staffLogout() {
  await clearStaffCookie();
}