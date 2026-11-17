"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { staff, staffInvites, staffPasswordResets, staffSessions } from "@/db/schema";
import { createStaffSession, hashPassword, hashToken, setStaffCookie, clearStaffCookie, verifyPassword, randomToken } from "@/lib/staff-auth";
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
    await db.insert(staffPasswordResets).values({ staffId: member.id, tokenHash: hashToken(token), expiresAt });
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
      } catch { }
    } else {
      // Reset-Link niemals in Logs (enthält Token). Nur redacted Info.
      console.log("Password reset requested (token redacted).");
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Anfrage fehlgeschlagen." };
  }
}

export async function resetPasswordWithToken(token: string, password: string) {
  try {
    const t = (token || "").trim();
    if (!t || t.length > 200) throw new Error("Ungültiger Link.");
    if (typeof password !== "string" || password.length < 10) throw new Error("Passwort muss mindestens 10 Zeichen haben.");
    const tokenHash = hashToken(t);
    const [reset] = await db.select().from(staffPasswordResets).where(eq(staffPasswordResets.tokenHash, tokenHash));
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new Error("Der Link ist ungültig oder abgelaufen.");
    const passwordHash = await hashPassword(password);
    await db.update(staff).set({ passwordHash, updatedAt: new Date() }).where(eq(staff.id, reset.staffId));
    await db.update(staffPasswordResets).set({ usedAt: new Date() }).where(eq(staffPasswordResets.id, reset.id));
    await db.delete(staffSessions).where(eq(staffSessions.staffId, reset.staffId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Zurücksetzen fehlgeschlagen." };
  }
}
