import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { Resend } from "resend";
import { db } from "@/db";
import { adminEnrollmentTokens, adminUsers } from "@/db/schema";
import { appendAuditEvent } from "./admin-audit";
import { hmacSha256, pepper, ipHash as ipHashFn } from "./admin-crypto";
import {
  createEnrollmentToken,
  consumeEnrollmentToken,
  getPendingTotp,
  setPendingTotp,
  validateEnrollmentToken,
  type EnrollmentPurpose,
} from "./admin-enrollment";
import {
  canLoginWithPassword,
  consumeRecoveryCodeForAdmin,
  createTrustedDevice,
  disableTotp,
  enableTotp,
  getAdminByEmail,
  getTotpSecret,
  isTotpEnabled,
  revokeTrustedDevices,
  setPasswordHash,
  updateLastStep,
} from "./admin-mfa";
import { consumeMfaPending, createMfaPending } from "./admin-mfa-pending";
import {
  checkPasswordPolicy,
  hashPassword,
  isBreachedPassword,
  verifyPassword,
  verifyPasswordDummy,
} from "./admin-password";
import { revokeAllAdminSessions, createAdminSession, setStepUp } from "./admin-session";
import { takeRateLimit } from "./rate-limit";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { emailFrom } from "./email";
import { renderEmail } from "./email-template";

export const GENERIC_LOGIN_ERROR = "E-Mail oder Passwort ist falsch.";
const LOCK_MS = 15 * 60 * 1000;

// Fehlermeldung aus einem Flow-Ergebnis lesen, ohne Union-Narrowing.
export function flowError(result: { ok: boolean; error?: string }): string {
  return result.error || "Fehler.";
}

export type FlowContext = { ip: string; userAgent: string | null };

export function csrfTokenFor(secret: string): string {
  return hmacSha256(pepper(), `admin-csrf:${secret}`);
}

async function sendAdminMail(to: string, subject: string, paragraphs: string[]): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.MAIL_DRY_RUN === "true") {
    console.info("[admin-mail dry-run]", { to, subject, paragraphs });
    return;
  }
  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: emailFrom(),
    to: [to],
    subject,
    html: renderEmail({
      title: subject,
      preheader: paragraphs[0] ?? subject,
      blocks: paragraphs.map(text => ({ type: "paragraph" as const, text })),
    }),
  });
}

function audit(ctx: FlowContext, eventType: string, actorAdminId: string | null, subjectAdminId: string | null, metadata?: Record<string, unknown>) {
  return appendAuditEvent({
    actorAdminId,
    subjectAdminId,
    eventType,
    ipHash: ctx.ip ? ipHashFn(ctx.ip) : null,
    userAgent: ctx.userAgent,
    metadata: metadata ?? null,
  });
}

// ---------------- Login Schritt 1: Passwort ----------------
export async function loginWithPassword(params: {
  email: string;
  password: string;
  ctx: FlowContext;
}): Promise<{ ok: true; mfaToken: string; csrfToken: string } | { ok: false; error: string }> {
  const email = params.email.trim().toLowerCase();
  if (!await takeRateLimit(`admin-pw-ip:${params.ctx.ip}`, 20, 15 * 60000)) {
    return { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
  }
  const admin = await getAdminByEmail(email);
  if (!admin || !admin.passwordHash) {
    await verifyPasswordDummy(params.password);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  if (!await takeRateLimit(`admin-pw:${admin.id}`, 5, 15 * 60000)) {
    return { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
  }
  const now = new Date();
  if (admin.lockedUntil && admin.lockedUntil > now) {
    await verifyPasswordDummy(params.password);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  const valid = await verifyPassword(params.password, admin.passwordHash);
  if (!valid) {
    const attempts = admin.failedPasswordAttempts + 1;
    const lock = attempts >= 5;
    await db.update(adminUsers).set({
      failedPasswordAttempts: lock ? 0 : attempts,
      lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : admin.lockedUntil,
      updatedAt: now,
    }).where(eq(adminUsers.id, admin.id));
    await audit(params.ctx, "admin.login.password_failed", admin.id, admin.id, { attempts, lock });
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  if (!canLoginWithPassword(admin)) {
    // Kein TOTP oder nicht aktiv: generisch bleiben, kein Hinweis auf den Grund.
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  await db.update(adminUsers).set({ failedPasswordAttempts: 0, updatedAt: now }).where(eq(adminUsers.id, admin.id));
  const mfaToken = await createMfaPending(admin.id);
  await audit(params.ctx, "admin.login.password_ok", admin.id, admin.id);
  return { ok: true, mfaToken, csrfToken: csrfTokenFor(mfaToken) };
}

// ---------------- Login Schritt 2: TOTP oder Recovery-Code ----------------
export async function completeTotpLogin(params: {
  mfaToken: string;
  code: string;
  trustDevice: boolean;
  ctx: FlowContext;
}): Promise<{ ok: true; sessionToken: string; trustedDeviceToken?: string; recoveryLeft?: number } | { ok: false; error: string }> {
  const adminId = await consumeMfaPending(params.mfaToken);
  if (!adminId) return { ok: false, error: "Bitte zuerst mit E-Mail und Passwort anmelden." };
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
  if (!admin || admin.status !== "active") return { ok: false, error: "Anmeldung fehlgeschlagen." };
  if (!await takeRateLimit(`admin-totp:${admin.id}`, 5, 5 * 60000)) {
    return { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
  }
  const now = new Date();
  if (admin.lockedUntil && admin.lockedUntil > now) return { ok: false, error: "Konto vorübergehend gesperrt." };

  const code = params.code.trim();
  let recoveryLeft: number | undefined;
  if (/^\d{6}$/.test(code)) {
    const secret = getTotpSecret(admin);
    if (!secret) return { ok: false, error: "2FA nicht eingerichtet." };
    const vr = verifyTotp(secret, code, admin.totpLastUsedStep);
    if (!vr.valid) {
      const attempts = admin.failedTotpAttempts + 1;
      const lock = attempts >= 5;
      await db.update(adminUsers).set({
        failedTotpAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : admin.lockedUntil,
        updatedAt: now,
      }).where(eq(adminUsers.id, admin.id));
      await audit(params.ctx, "admin.login.totp_failed", admin.id, admin.id, { attempts, lock });
      return { ok: false, error: "Code ungültig oder bereits verwendet." };
    }
    await updateLastStep(admin.id, vr.counter);
  } else {
    const consumed = await consumeRecoveryCodeForAdmin(admin.id, code);
    if (!consumed) return { ok: false, error: "Recovery-Code ungültig oder bereits verwendet." };
    const { countRecoveryCodes } = await import("./admin-recovery");
    recoveryLeft = await countRecoveryCodes(admin.id);
    await audit(params.ctx, "admin.login.recovery_used", admin.id, admin.id, { recoveryLeft });
  }

  await db.update(adminUsers).set({ failedTotpAttempts: 0, lastLoginAt: now, updatedAt: now }).where(eq(adminUsers.id, admin.id));
  const session = await createAdminSession({ adminId: admin.id, userAgent: params.ctx.userAgent, ip: params.ctx.ip });
  let trustedDeviceToken: string | undefined;
  if (params.trustDevice) {
    trustedDeviceToken = await createTrustedDevice(admin.email, params.ctx, session.token);
  }
  await audit(params.ctx, "admin.login.success", admin.id, admin.id, { trustDevice: params.trustDevice });
  return { ok: true, sessionToken: session.token, trustedDeviceToken, recoveryLeft };
}

// Trusted Device: überspringt NUR den TOTP-Schritt, nie das Passwort.
export async function tryTrustedDevice(params: {
  email: string;
  trustedDeviceToken: string;
  ctx: FlowContext;
}): Promise<{ adminId: string; deviceId: string } | null> {
  const { findTrustedDevice } = await import("./admin-mfa");
  const admin = await getAdminByEmail(params.email);
  if (!admin || !canLoginWithPassword(admin)) return null;
  const device = await findTrustedDevice(params.trustedDeviceToken, admin.email, params.ctx);
  if (!device) return null;
  return { adminId: admin.id, deviceId: device.id };
}

// ---------------- Setup-Wizard (invite / password_reset / totp_reset) ----------------
export async function setupValidate(params: { rawToken: string; pin?: string | null }) {
  const result = await validateEnrollmentToken({ rawToken: params.rawToken, pin: params.pin });
  if (!result.ok || !result.adminId) return { ok: false as const, reason: result.reason ?? "invalid" };
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, result.adminId));
  if (!admin) return { ok: false as const, reason: "invalid" };
  return { ok: true as const, tokenId: result.tokenId!, adminId: admin.id, email: admin.email, purpose: result.purpose!, needsPin: !!((await findTokenPin(result.tokenId!))) };
}

async function findTokenPin(tokenId: string) {
  const [row] = await db.select({ pinHash: adminEnrollmentTokens.pinHash }).from(adminEnrollmentTokens).where(eq(adminEnrollmentTokens.id, tokenId));
  return row?.pinHash ?? null;
}

export async function setupSetPassword(params: {
  tokenId: string;
  rawToken: string;
  pin?: string | null;
  password: string;
  ctx: FlowContext;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = await validateEnrollmentToken({ rawToken: params.rawToken, pin: params.pin });
  if (!validation.ok || !validation.adminId) return { ok: false, error: "Link ungültig, abgelaufen oder PIN falsch." };
  const policyError = checkPasswordPolicy(params.password);
  if (policyError) return { ok: false, error: policyError };
  if (await isBreachedPassword(params.password)) {
    return { ok: false, error: "Dieses Passwort taucht in bekannten Datenleaks auf. Bitte wähle ein anderes." };
  }
  const hash = await hashPassword(params.password);
  await setPasswordHash(validation.adminId, hash);
  await revokeTrustedDevices(await adminEmail(validation.adminId));
  await audit(params.ctx, "admin.password.set", validation.adminId, validation.adminId, { purpose: validation.purpose });
  return { ok: true };
}

export async function setupStartTotp(params: {
  tokenId: string;
  rawToken: string;
  pin?: string | null;
  ctx: FlowContext;
}): Promise<{ ok: true; secret: string; qrDataUrl: string } | { ok: false; error: string }> {
  const validation = await validateEnrollmentToken({ rawToken: params.rawToken, pin: params.pin });
  if (!validation.ok || !validation.adminId) return { ok: false, error: "Link ungültig oder abgelaufen." };
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, validation.adminId));
  if (!admin) return { ok: false, error: "Link ungültig." };
  const secret = generateTotpSecret();
  await setPendingTotp(params.tokenId, secret);
  const uri = otpauthUri(secret, admin.email);
  const qrDataUrl = await QRCode.toDataURL(uri);
  return { ok: true, secret, qrDataUrl };
}

export async function setupConfirmTotp(params: {
  tokenId: string;
  rawToken: string;
  pin?: string | null;
  code: string;
  ctx: FlowContext;
}): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const validation = await validateEnrollmentToken({ rawToken: params.rawToken, pin: params.pin });
  if (!validation.ok || !validation.adminId) return { ok: false, error: "Link ungültig oder abgelaufen." };
  const pending = await getPendingTotp(params.tokenId);
  if (!pending) return { ok: false, error: "Einrichtung abgelaufen. Bitte erneut starten." };
  const vr = verifyTotp(pending, params.code.trim(), null);
  if (!vr.valid) return { ok: false, error: "Code ungültig. Prüfe die App und versuche es erneut." };
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, validation.adminId));
  if (!admin) return { ok: false, error: "Link ungültig." };
  const purpose = validation.purpose as EnrollmentPurpose;
  if (purpose === "totp_reset") {
    await revokeAllAdminSessions(admin.id, "totp_reset");
    await revokeTrustedDevices(admin.email);
  }
  const { recoveryCodes } = await enableTotp(admin.id, pending);
  await db.update(adminUsers).set({
    status: purpose === "invite" ? "active" : admin.status,
    totpLastUsedStep: vr.counter,
    updatedAt: new Date(),
  }).where(eq(adminUsers.id, admin.id));
  await consumeEnrollmentToken(params.tokenId);
  await audit(params.ctx, purpose === "totp_reset" ? "admin.totp.reset_done" : "admin.totp.enrolled", validation.adminId, admin.id);
  return { ok: true, recoveryCodes };
}

// Passwort-Reset verbrauchen: NUR Passwort neu, TOTP bleibt, Sessions weg.
export async function consumePasswordReset(params: {
  tokenId: string;
  ctx: FlowContext;
}): Promise<void> {
  const [row] = await db.select().from(adminEnrollmentTokens).where(eq(adminEnrollmentTokens.id, params.tokenId));
  if (!row) return;
  await consumeEnrollmentToken(params.tokenId);
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, row.adminId));
  if (!admin) return;
  await revokeAllAdminSessions(admin.id, "password_reset");
  await revokeTrustedDevices(admin.email);
  await audit(params.ctx, "admin.password.reset_consumed", row.adminId, admin.id);
  await sendAdminMail(admin.email, "Dein Admin-Passwort wurde zurückgesetzt", [
    "Das Passwort deines Admin-Kontos wurde soeben geändert.",
    "Wichtig: Dein TOTP-Secret (Google Authenticator) bleibt unverändert bestehen – beim nächsten Login wird weiterhin dein 6-stelliger Code verlangt.",
    "Falls du das nicht warst: sofort Passwort erneut zurücksetzen und den Festwirt informieren.",
  ]);
}

// ---------------- Admin-Verwaltung ----------------
export async function adminEmail(adminId: string): Promise<string> {
  const [row] = await db.select({ email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, adminId));
  return row?.email ?? "";
}

export async function countActiveAdmins(): Promise<number> {
  const rows = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.status, "active"));
  return rows.length;
}

export async function inviteAdmin(params: {
  email: string;
  actorAdminId: string;
  baseUrl: string;
  ctx: FlowContext;
}): Promise<{ ok: true; link: string; pin: string; expiresAt: Date } | { ok: false; error: string }> {
  const email = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Ungültige E-Mail-Adresse." };
  let admin = await getAdminByEmail(email);
  if (!admin) {
    [admin] = await db.insert(adminUsers).values({
      email,
      emailNormalized: email,
      role: "owner",
      status: "pending_enrollment",
      createdBy: await adminEmail(params.actorAdminId),
    }).returning();
  }
  if (admin.status === "removed") {
    [admin] = await db.update(adminUsers).set({ status: "pending_enrollment", removedAt: null, updatedAt: new Date() })
      .where(eq(adminUsers.id, admin.id)).returning();
  }
  const token = await createEnrollmentToken({ adminId: admin.id, purpose: "invite", createdBy: params.actorAdminId, createdVia: "ui" });
  const link = `${params.baseUrl}/admin/setup#token=${token.rawToken}`;
  await audit(params.ctx, "admin.invite.created", params.actorAdminId, admin.id);
  await sendAdminMail(email, "Einladung zum Maurer Events Admin", [
    "Du wurdest als Administrator für Maurer Events eingeladen.",
    `Einrichtungs-Link (72 Stunden gültig, einmalig): ${link}`,
    `Deine Einrichtungs-PIN: ${token.pin ?? ""}`,
    "Beides zusammen im Wizard eingeben: erst die PIN, dann Passwort setzen und Authenticator einrichten.",
  ]);
  return { ok: true, link, pin: token.pin ?? "", expiresAt: token.expiresAt };
}

export async function requestPasswordReset(params: {
  email: string;
  actorAdminId: string | null;
  baseUrl: string;
  ctx: FlowContext;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = params.email.trim().toLowerCase();
  // Identische Antwort unabhängig davon, ob das Konto existiert (keine Enumeration).
  if (!await takeRateLimit(`admin-reset-ip:${params.ctx.ip}`, 10, 3600_000)) return { ok: true };
  const admin = await getAdminByEmail(email);
  if (!admin) return { ok: true };
  if (!await takeRateLimit(`admin-reset:${admin.id}`, 3, 3600_000)) return { ok: true };
  const token = await createEnrollmentToken({ adminId: admin.id, purpose: "password_reset", createdBy: params.actorAdminId, createdVia: params.actorAdminId ? "ui" : "cli" });
  await audit(params.ctx, "admin.password.reset_requested", params.actorAdminId, admin.id);
  await sendAdminMail(email, "Passwort-Reset für deinen Admin-Zugang", [
    "Für dein Admin-Konto wurde ein Passwort-Reset angefordert.",
    `Link (60 Minuten gültig, einmalig): ${params.baseUrl}/admin/setup#token=${token.rawToken}`,
    "Wichtig: Der Reset ändert NUR dein Passwort. Dein TOTP (Google Authenticator) bleibt Pflicht – ohne deinen 6-stelligen Code bleibt der Zugang gesperrt.",
    "Falls du das nicht warst: Link ignorieren; er verfällt automatisch.",
  ]);
  return { ok: true };
}

export async function resetTotpForAdmin(params: {
  targetAdminId: string;
  actorAdminId: string;
  baseUrl: string;
  ctx: FlowContext;
}): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  if (params.targetAdminId === params.actorAdminId) {
    return { ok: false, error: "Du kannst dein eigenes TOTP nicht über diesen Weg zurücksetzen." };
  }
  const active = await countActiveAdmins();
  const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, params.targetAdminId));
  if (!target) return { ok: false, error: "Admin nicht gefunden." };
  if (target.status === "active" && active <= 1) {
    return { ok: false, error: "Der letzte aktive Admin kann nicht zurückgesetzt werden." };
  }
  const token = await createEnrollmentToken({ adminId: target.id, purpose: "totp_reset", createdBy: params.actorAdminId, createdVia: "ui" });
  const link = `${params.baseUrl}/admin/setup#token=${token.rawToken}`;
  await audit(params.ctx, "admin.totp.reset_requested", params.actorAdminId, target.id);
  const actorMail = await adminEmail(params.actorAdminId);
  await sendAdminMail(target.email, "Dein Admin-2FA wird neu eingerichtet", [
    `Ein anderer Administrator (${actorMail}) hat die Neuenrichtung deines TOTP (Google Authenticator) gestartet.`,
    `Link (30 Minuten gültig): ${params.baseUrl}/admin/setup#token=${token.rawToken}`,
    "Alle bestehenden Sitzungen werden dabei beendet.",
  ]);
  await sendAdminMail(actorMail, "TOTP-Reset durchgeführt", [
    `Du hast die TOTP-Neueinrichtung für ${target.email} gestartet.`,
    "Falls das nicht deine Absicht war: sofort Passwort des Zielkontos zurücksetzen.",
  ]);
  return { ok: true, link };
}

export async function removeAdmin(params: {
  targetAdminId: string;
  actorAdminId: string;
  ctx: FlowContext;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (params.targetAdminId === params.actorAdminId) return { ok: false, error: "Du kannst dich nicht selbst entfernen." };
  const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, params.targetAdminId));
  if (!target) return { ok: false, error: "Admin nicht gefunden." };
  const active = await countActiveAdmins();
  if (target.status === "active" && active <= 1) return { ok: false, error: "Der letzte aktive Admin kann nicht entfernt werden." };
  await db.update(adminUsers).set({ status: "removed", removedAt: new Date(), updatedAt: new Date() }).where(eq(adminUsers.id, target.id));
  await revokeAllAdminSessions(target.id, "admin_removed");
  await revokeTrustedDevices(target.email);
  await audit(params.ctx, "admin.removed", params.actorAdminId, target.id);
  const actorMail = await adminEmail(params.actorAdminId);
  await sendAdminMail(target.email, "Admin-Zugang entfernt", ["Dein Admin-Zugang wurde entfernt. Falls das falsch ist, wende dich an den Festwirt."]);
  await sendAdminMail(actorMail, "Admin-Zugang entfernt", [`Der Admin-Zugang für ${target.email} wurde entfernt.`]);
  return { ok: true };
}

export async function markStepUp(sessionToken: string, code: string, ctx: FlowContext): Promise<{ ok: true } | { ok: false; error: string }> {
  const { getAdminSession } = await import("./admin-session");
  const session = await getAdminSession(sessionToken);
  if (!session) return { ok: false, error: "Sitzung ungültig." };
  if (!await takeRateLimit(`admin-stepup:${session.adminId}`, 5, 5 * 60000)) {
    return { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." };
  }
  const secret = getTotpSecret(session.admin);
  if (!secret) return { ok: false, error: "2FA nicht eingerichtet." };
  const vr = verifyTotp(secret, code.trim(), session.admin.totpLastUsedStep);
  if (!vr.valid) return { ok: false, error: "Code ungültig oder bereits verwendet." };
  await updateLastStep(session.adminId, vr.counter);
  await setStepUp(sessionToken);
  await audit(ctx, "admin.step_up", session.adminId, session.adminId);
  return { ok: true };
}

export { isTotpEnabled, disableTotp };
