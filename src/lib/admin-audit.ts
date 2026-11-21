import { db } from '@/db';
import { adminAuditLog, adminUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sha256Hex } from './admin-crypto';

export async function getLastAuditHash(): Promise<string | null> {
  const all = await db.select({ entryHash: adminAuditLog.entryHash })
    .from(adminAuditLog)
    .orderBy(adminAuditLog.id);
  if (all.length === 0) return null;
  return all[all.length - 1].entryHash;
}

export async function appendAuditEvent(params: {
  actorAdminId?: string | null;
  subjectAdminId?: string | null;
  eventType: string;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const occurredAt = new Date();
  const prevHash = await getLastAuditHash();
  const payload = {
    occurredAt: occurredAt.toISOString(),
    actorAdminId: params.actorAdminId ?? null,
    subjectAdminId: params.subjectAdminId ?? null,
    eventType: params.eventType,
    ipHash: params.ipHash ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? null,
    prevHash: prevHash ?? null,
  };
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const entryHash = sha256Hex((prevHash ?? '') + canonical);
  await db.insert(adminAuditLog).values({
    occurredAt,
    actorAdminId: params.actorAdminId ?? null,
    subjectAdminId: params.subjectAdminId ?? null,
    eventType: params.eventType,
    ipHash: params.ipHash ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? null,
    prevHash: prevHash ?? null,
    entryHash,
  });
}

export async function verifyAuditChain(): Promise<{ ok: boolean; brokenAt?: number }> {
  const rows = await db.select().from(adminAuditLog).orderBy(adminAuditLog.id);
  let prev: string | null = null;
  for (const r of rows) {
    if (r.prevHash !== prev) return { ok: false, brokenAt: r.id };
    const payload = {
      occurredAt: r.occurredAt instanceof Date ? r.occurredAt.toISOString() : String(r.occurredAt),
      actorAdminId: r.actorAdminId ?? null,
      subjectAdminId: r.subjectAdminId ?? null,
      eventType: r.eventType,
      ipHash: r.ipHash ?? null,
      userAgent: r.userAgent ?? null,
      metadata: r.metadata ?? null,
      prevHash: r.prevHash ?? null,
    };
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const expected = sha256Hex((r.prevHash ?? '') + canonical);
    if (expected !== r.entryHash) return { ok: false, brokenAt: r.id };
    prev = r.entryHash;
  }
  return { ok: true };
}
