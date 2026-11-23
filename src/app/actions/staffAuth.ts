"use server";

import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { staff, staffInvites, staffPasswordResets, staffSessions } from "@/db/schema";
import { createStaffSession, hashPassword, hashToken, setStaffCookie, clearStaffCookie, verifyPassword, randomToken, STAFF_COOKIE } from "@/lib/staff-auth";
import { takeRateLimit } from "@/lib/rate-limit";
import { Resend } from "resend";
import { emailFrom } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { escapeHtml } from "@/lib/escape";

async function inviteClientKey(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const forwarded = (requestHeaders.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100);
    return forwarded || "unknown";
  } catch {
    return "unknown";
  }
}

let dummyPasswordHash: Promise<string> | null = null;
function dummyHash() {
  dummyPasswordHash ||= hashPassword("timing-dummy-not-a-user-password");
  return dummyPasswordHash;
}

export async function acceptStaffInvite(data: { token: string; password: string }) {
  try {
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (!token || token.length > 200) throw new Error("Ungültiger Einladungslink.");
    const tokenHash = hashToken(token);
    const client = await inviteClientKey();
    if (!await takeRateLimit(`staff-invite-ip:${client}`, 10, 15 * 60000)) return { success: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
    if (!await takeRateLimit(`staff-invite:${tokenHash}`, 5, 15 * 60000)) return { success: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.tokenHash, tokenHash));
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new Error("Der Einladungslink ist ungültig oder abgelaufen.");
    const passwordHash = await hashPassword(data?.password);
    await db.transaction(async tx => {
      const [claimed] = await tx.update(staffInvites).set({ usedAt: new Date() }).where(and(
        eq(staffInvites.id, invite.id), isNull(staffInvites.usedAt), gt(staffInvites.expiresAt, new Date()),
      )).returning();
      if (!claimed) throw new Error("Der Einladungslink wurde bereits verwendet.");
      const [member] = await tx.update(staff).set({ passwordHash, status: "onboarding", updatedAt: new Date() })
        .where(and(eq(staff.id, invite.staffId), ne(staff.status, "inactive"))).returning({ id: staff.id });
      if (!member) throw new Error("Dieser Mitarbeiterzugang ist deaktiviert.");
      await tx.delete(staffSessions).where(eq(staffSessions.staffId, invite.staffId));
    });
    const session = await createStaffSession(invite.staffId);
    await setStaffCookie(session.id, session.validUntil);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Einladung konnte nicht angenommen werden." };
  }
}

export async function staffLogin(data: { email: string; password: string }): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data?.password === "string" ? data.password : "";
    const genericError = { success: false, error: "E-Mail oder Passwort ist falsch." };
    if (password.length > 200) return genericError;
    const client = await inviteClientKey();
    if (!await takeRateLimit(`staff-login-ip:${client}`, 20, 15 * 60000)) return { success: false, error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." };
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await verifyPassword(password, await dummyHash());
      return genericError;
    }
    if (!await takeRateLimit(`staff-login:${email}`, 5, 15 * 60000)) return { success: false, error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." };
    const [member] = await db.select().from(staff).where(sql`lower(trim(${staff.email})) = ${email}`);
    const valid = await verifyPassword(password, member?.passwordHash ?? await dummyHash());
    if (!member || member.status === "inactive" || !valid) return genericError;
    const session = await createStaffSession(member.id);
    await setStaffCookie(session.id, session.validUntil);
    return { success: true };
  } catch {
    return { success: false, error: "Anmeldung fehlgeschlagen. Bitte später erneut versuchen." };
  }
}

export async function staffLogout() {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  try {
    if (token) await db.delete(staffSessions).where(eq(staffSessions.id, token));
  } finally {
    await clearStaffCookie();
  }
}

export async function requestPasswordReset(email: string) {
  try {
    const normalized = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { success: true };
    const client = await inviteClientKey();
    if (!await takeRateLimit("pwreset-ip:" + client, 5, 15 * 60000)) return { success: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
    const [member] = await db.select().from(staff).where(sql`lower(trim(${staff.email})) = ${normalized}`);
    if (!member || member.status === "inactive") return { success: true };
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 60000);
    await db.transaction(async tx => {
      await tx.update(staffPasswordResets).set({ usedAt: new Date() }).where(and(eq(staffPasswordResets.staffId, member.id), isNull(staffPasswordResets.usedAt)));
      await tx.insert(staffPasswordResets).values({ staffId: member.id, tokenHash: hashToken(token), expiresAt });
    });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetUrl = baseUrl + "/team/passwort-neu?token=" + encodeURIComponent(token);
    if (process.env.RESEND_API_KEY) {
      try {
        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: emailFrom(), to: [member.email], subject: "Passwort zurücksetzen – Maurer Events",
          html: renderEmail({
            title: "Passwort zurücksetzen",
            preheader: "Passwort zurücksetzen – Link gültig 30 Minuten.",
            blocks: [
              { type: "paragraph", text: `Hallo ${escapeHtml(member.firstName)},` },
              { type: "paragraph", text: "du hast ein neues Passwort angefordert. Klicke innerhalb von 30 Minuten auf den Button:" },
              { type: "button", label: "Passwort zurücksetzen", href: resetUrl },
              { type: "note", text: "Falls du das nicht warst, ignoriere diese E-Mail." },
            ],
            footerNote: "Maurer Events · Mitarbeiterportal",
          }),
        });
      } catch { /* generische Antwort beibehalten */ }
    } else {
      console.log("Password reset requested (token redacted).");
    }
    return { success: true };
  } catch {
    return { success: false, error: "Anfrage fehlgeschlagen. Bitte später erneut versuchen." };
  }
}

export async function resetPasswordWithToken(token: string, password: string) {
  try {
    const t = (token || "").trim();
    if (!t || t.length > 200) throw new Error("Ungültiger Link.");
    if (typeof password !== "string" || password.length < 10 || password.length > 200) throw new Error("Passwort muss 10 bis 200 Zeichen haben.");
    const tokenHash = hashToken(t);
    const passwordHash = await hashPassword(password);
    await db.transaction(async tx => {
      const [claimed] = await tx.update(staffPasswordResets).set({ usedAt: new Date() }).where(and(
        eq(staffPasswordResets.tokenHash, tokenHash), isNull(staffPasswordResets.usedAt), gt(staffPasswordResets.expiresAt, new Date()),
      )).returning();
      if (!claimed) throw new Error("Der Link ist ungültig oder abgelaufen.");
      const [member] = await tx.update(staff).set({ passwordHash, updatedAt: new Date() })
        .where(and(eq(staff.id, claimed.staffId), ne(staff.status, "inactive"))).returning({ id: staff.id });
      if (!member) throw new Error("Dieser Mitarbeiterzugang ist deaktiviert.");
      await tx.update(staffPasswordResets).set({ usedAt: new Date() }).where(and(eq(staffPasswordResets.staffId, claimed.staffId), isNull(staffPasswordResets.usedAt)));
      await tx.delete(staffSessions).where(eq(staffSessions.staffId, claimed.staffId));
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Zurücksetzen fehlgeschlagen." };
  }
}
