import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { staff, staffSessions } from "@/db/schema";
import { UUID_PATTERN } from "./reservation-policy";

const scrypt = promisify(crypto.scrypt);
export const STAFF_COOKIE = "staff_token";
const SESSION_DAYS = 7;

function requireSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ist nicht korrekt konfiguriert.");
  return secret;
}

export async function hashPassword(password: string) {
  if (typeof password !== "string" || password.length < 10 || password.length > 200) throw new Error("Das Passwort muss mindestens 10 Zeichen lang sein.");
  const salt = crypto.randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored || !password) return false;
  const [scheme, saltPart, hashPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, "base64");
  const derived = (await scrypt(password, Buffer.from(saltPart, "base64"), expected.length)) as Buffer;
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHmac("sha256", requireSecret()).update(token).digest("hex");
}

export async function createStaffSession(staffId: string) {
  const validUntil = new Date(Date.now() + SESSION_DAYS * 86400000);
  const [session] = await db.insert(staffSessions).values({ staffId, validUntil }).returning();
  await db.update(staff).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(staff.id, staffId));
  return session;
}

export async function setStaffCookie(sessionId: string, validUntil: Date) {
  (await cookies()).set(STAFF_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: validUntil,
    path: "/",
  });
}

export async function staffSession(token: string | undefined) {
  if (!token || !UUID_PATTERN.test(token)) return null;
  const [row] = await db.select({ session: staffSessions, member: staff }).from(staffSessions)
    .innerJoin(staff, eq(staff.id, staffSessions.staffId))
    .where(and(eq(staffSessions.id, token), gt(staffSessions.validUntil, new Date())));
  return row || null;
}

export async function requireStaffMember(redirectOnFailure = false) {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  const row = await staffSession(token);
  if (!row) {
    if (redirectOnFailure) redirect("/team/login");
    throw new Error("Unauthorized: Invalid or expired staff session.");
  }
  return row.member;
}

export async function clearStaffCookie() {
  (await cookies()).delete(STAFF_COOKIE);
}

export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 100) || null;
}