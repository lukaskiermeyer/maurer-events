import { db } from '@/db';
import { adminRecoveryCodes } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { randomCrockford, formatCrockford, hmacSha256, pepper } from './admin-crypto';

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomCrockford(10);
    codes.push(formatCrockford(raw, 5));
  }
  return codes;
}

export async function storeRecoveryCodes(adminId: string, codes: string[]): Promise<string> {
  const batchId = (await import('node:crypto')).randomUUID();
  // delete existing unconsumed? We'll just add new batch; old remain but marked? Spec: regenerate replaces. We'll revoke old unconsumed.
  await db.update(adminRecoveryCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(adminRecoveryCodes.adminId, adminId), isNull(adminRecoveryCodes.consumedAt)));
  for (const code of codes) {
    const normalized = code.replace(/-/g, '');
    const hash = hmacSha256(pepper(), normalized);
    await db.insert(adminRecoveryCodes).values({
      adminId,
      batchId,
      codeHash: hash,
    });
  }
  return batchId;
}

export async function consumeRecoveryCode(adminId: string, code: string): Promise<boolean> {
  const normalized = code.replace(/-/g, '').toUpperCase();
  const hash = hmacSha256(pepper(), normalized);
  const rows = await db.update(adminRecoveryCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(adminRecoveryCodes.adminId, adminId), eq(adminRecoveryCodes.codeHash, hash), isNull(adminRecoveryCodes.consumedAt)))
    .returning({ id: adminRecoveryCodes.id });
  return rows.length === 1;
}

export async function countRecoveryCodes(adminId: string): Promise<number> {
  const rows = await db.select().from(adminRecoveryCodes)
    .where(and(eq(adminRecoveryCodes.adminId, adminId), isNull(adminRecoveryCodes.consumedAt)));
  return rows.length;
}
