'use server';

import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { BookingError, guestDetails } from '@/lib/reservation-policy';
import { audit } from '@/lib/audit';
import { isAdminEmail } from '@/lib/admin-identity';

export type AdminUserRow = { id: string; email: string; createdBy: string; createdAt: Date };

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  await requireAdmin(true);
  const rows = await db.select({
    id: adminUsers.id,
    email: adminUsers.email,
    createdBy: adminUsers.createdBy,
    createdAt: adminUsers.createdAt,
  }).from(adminUsers).orderBy(adminUsers.createdAt);
  return rows;
}

export async function addAdminUser(emailInput: string) {
  const actor = await requireAdmin(true);
  const email = guestDetails('Admin', emailInput, 1).email;

  // Bereits in Env-Liste?
  if (isAdminEmail(email)) throw new BookingError('Diese E-Mail hat bereits vollen Admin-Zugriff (Umgebungsvariable).');

  // Bereits in DB?
  const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(sql`lower(trim(${adminUsers.email})) = ${email}`);
  if (existing) throw new BookingError('Diese E-Mail ist bereits als Admin eingetragen.');

  // Mindestens ein weiterer Admin muss bleiben (Schutz vor Selbst-Aussperrung nicht nötig, da Env-Admins immer bleiben).
  const [created] = await db.insert(adminUsers).values({ email, createdBy: actor.email }).returning();
  await audit('admin', actor.email, 'admin_user.create', 'admin_user', created.id, { email });
  return created;
}

export async function removeAdminUser(id: string) {
  const actor = await requireAdmin(true);

  // Darf den eigenen Eintrag nicht löschen, wenn er der letzte DB-Admin wäre und keine Env-Admins existieren.
  const [target] = await db.select({ id: adminUsers.id, email: adminUsers.email }).from(adminUsers).where(eq(adminUsers.id, id));
  if (!target) throw new BookingError('Admin nicht gefunden.');

  // Env-Admins zählen immer als verbleibende Admins.
  const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const dbCount = await db.select({ c: sql<number>`count(*)::int` }).from(adminUsers);
  const remainingDb = (dbCount[0]?.c ?? 0) - 1;
  if (envAdmins.length === 0 && remainingDb < 1) {
    throw new BookingError('Der letzte Admin kann nicht entfernt werden.');
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, id));
  await audit('admin', actor.email, 'admin_user.remove', 'admin_user', id, { email: target.email });
  return { success: true };
}