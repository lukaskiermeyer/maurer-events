import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { adminMfaPending } from "@/db/schema";
import { hashToken, randomToken } from "./admin-crypto";

const TTL_MS = 5 * 60 * 1000;

// Fenster zwischen erfolgreichem Passwort-Check und TOTP-Bestätigung.
// Das Cookie (__Host-adm_mfa) enthält den Raw-Token; die DB-Zeile ist single-use.
export async function createMfaPending(adminId: string): Promise<string> {
  const raw = randomToken(32);
  const tokenHash = hashToken(raw);
  const now = new Date();
  await db.delete(adminMfaPending)
    .where(and(eq(adminMfaPending.adminId, adminId), lt(adminMfaPending.expiresAt, now)));
  await db.insert(adminMfaPending).values({
    tokenHash,
    adminId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TTL_MS),
  });
  return raw;
}

export async function consumeMfaPending(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const [row] = await db.select().from(adminMfaPending).where(eq(adminMfaPending.tokenHash, tokenHash));
  if (!row || row.consumedAt || row.expiresAt <= new Date()) return null;
  const [updated] = await db.update(adminMfaPending)
    .set({ consumedAt: new Date() })
    .where(and(eq(adminMfaPending.tokenHash, tokenHash), isNull(adminMfaPending.consumedAt)))
    .returning();
  return updated ? updated.adminId : null;
}
