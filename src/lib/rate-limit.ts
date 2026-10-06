import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { securityRateLimits } from '@/db/schema';
import type { BookingTx } from './reservation-db';

// Atomic limits shared by all application instances.
export async function takeRateLimit(key: string, limit: number, windowMs: number, connection: typeof db | BookingTx = db) {
  const digest = createHash('sha256').update(key).digest('hex');
  const now = new Date();
  const nowSql = now.toISOString();
  const resetAt = new Date(now.getTime() + windowMs);
  const [entry] = await connection.insert(securityRateLimits).values({ key: digest, count: 1, resetAt })
    .onConflictDoUpdate({ target: securityRateLimits.key, set: {
      count: sql`CASE WHEN ${securityRateLimits.resetAt} <= ${nowSql}::timestamp THEN 1 ELSE ${securityRateLimits.count} + 1 END`,
      resetAt: sql`CASE WHEN ${securityRateLimits.resetAt} <= ${nowSql}::timestamp THEN ${resetAt.toISOString()}::timestamp ELSE ${securityRateLimits.resetAt} END`,
    }, setWhere: sql`${securityRateLimits.resetAt} <= ${nowSql}::timestamp OR ${securityRateLimits.count} < ${limit}` }).returning();
  return !!entry;
}
