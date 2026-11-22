"use server";
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminSessions } from '@/db/schema';
import { revokeAdminSession } from '@/lib/admin-session';
import { UUID_PATTERN } from '@/lib/reservation-policy';

export async function logout() {
  const store = await cookies();
  const token = store.get('__Host-adm_session')?.value;
  if (token) await revokeAdminSession(token, 'logout');
  const legacy = store.get('admin_token')?.value;
  if (legacy && UUID_PATTERN.test(legacy)) await db.delete(adminSessions).where(eq(adminSessions.id, legacy));
  store.delete('__Host-adm_session');
  store.delete('__Host-adm_mfa');
  store.delete('__Host-adm_trusted');
  store.delete('admin_token');
  return { success: true };
}
