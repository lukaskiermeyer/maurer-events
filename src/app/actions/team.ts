"use server";

import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { translateFields } from "@/lib/translate";
import { uuid } from "@/lib/reservation-policy";
import { localized } from "@/lib/localize";

function revalidateTeam() {
  revalidatePath("/ueber-uns");
  revalidatePath("/admin");
}

// ---------- Team-Stimmen (öffentlich) ----------

// „Über uns": Name, Position, Zitat + optionales Foto, in Admin-Reihenfolge.
export async function getTeamMembers(locale: string) {
  const rows = await db.select().from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.createdAt));
  return rows.map(m => {
    const quote = localized(m, "quote", locale);
    return {
      name: m.name,
      role: localized(m, "role", locale),
      quote,
      spruch: quote,
      image: m.imageUrl ?? undefined,
    };
  });
}

// ---------- Team-Stimmen (Admin) ----------

export async function getAdminTeamMembers() {
  await requireAdmin();
  return await db.select().from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.createdAt));
}

function assertMemberText(data: { name?: string; role?: string; quote?: string }) {
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120)) throw new Error('Ungültiger Name.');
  if (data.role !== undefined && (typeof data.role !== 'string' || !data.role.trim() || data.role.length > 120)) throw new Error('Ungültige Position.');
  if (data.quote !== undefined && (typeof data.quote !== 'string' || !data.quote.trim() || data.quote.length > 500)) throw new Error('Ungültiges Zitat.');
}

export type MemberTexts = {
  role?: string;
  quote?: string;
  roleEn?: string | null;
  roleBar?: string | null;
  quoteEn?: string | null;
  quoteBar?: string | null;
};

export async function createTeamMember(data: {
  name: string;
  role: string;
  quote: string;
  imageUrl?: string | null;
} & MemberTexts) {
  await requireAdmin();
  assertMemberText(data);
  const translated = await translateFields({ role: data.role, quote: data.quote });
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${teamMembers.sortOrder}), 0)` })
    .from(teamMembers);
  const [row] = await db.insert(teamMembers).values({
    name: data.name.trim(),
    role: data.role.trim(),
    quote: data.quote.trim(),
    roleEn: data.roleEn !== undefined ? data.roleEn : translated.en.role,
    roleBar: data.roleBar !== undefined ? data.roleBar : translated.bar.role,
    quoteEn: data.quoteEn !== undefined ? data.quoteEn : translated.en.quote,
    quoteBar: data.quoteBar !== undefined ? data.quoteBar : translated.bar.quote,
    imageUrl: data.imageUrl || null,
    sortOrder: Number(maxOrder) + 1,
  }).returning();
  revalidateTeam();
  return row;
}

export async function updateTeamMember(id: string, data: {
  name?: string;
  imageUrl?: string | null;
} & MemberTexts) {
  await requireAdmin();
  uuid(id);
  assertMemberText(data);
  const updates: Partial<typeof teamMembers.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.role !== undefined) updates.role = data.role.trim();
  if (data.quote !== undefined) updates.quote = data.quote.trim();
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl || null;

  // Manuelle EN/Bar-Werte haben Vorrang; KI füllt nur leere Ziele ohne expliziten Wert.
  const [cur] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
  for (const f of [{ src: 'role', en: 'roleEn', bar: 'roleBar' }, { src: 'quote', en: 'quoteEn', bar: 'quoteBar' }] as const) {
    const explicitEn = data[f.en];
    const explicitBar = data[f.bar];
    if (explicitEn !== undefined) updates[f.en] = explicitEn;
    if (explicitBar !== undefined) updates[f.bar] = explicitBar;
    const deChanged = data[f.src] !== undefined;
    const enEmpty = !cur?.[f.en]?.trim();
    const barEmpty = !cur?.[f.bar]?.trim();
    if (deChanged && ((explicitEn === undefined && enEmpty) || (explicitBar === undefined && barEmpty))) {
      const t = await translateFields({ [f.src]: data[f.src] as string });
      if (explicitEn === undefined && enEmpty) updates[f.en] = t.en[f.src];
      if (explicitBar === undefined && barEmpty) updates[f.bar] = t.bar[f.src];
    }
  }

  const [row] = await db.update(teamMembers).set(updates).where(eq(teamMembers.id, id)).returning();
  if (!row) throw new Error('Mitarbeiter nicht gefunden.');
  revalidateTeam();
  return row;
}

export async function deleteTeamMember(id: string) {
  await requireAdmin();
  uuid(id);
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
  revalidateTeam();
}

// Reihenfolge: tauscht den Platz mit dem Nachbarn in Pfeilrichtung.
// Bestimmt die Anzeige auf „Über uns". Gibt die sortierte Liste ({id, sortOrder}) zurück.
export async function moveTeamMember(memberId: string, direction: -1 | 1) {
  await requireAdmin();
  uuid(memberId);
  const members = await db.select({ id: teamMembers.id, sortOrder: teamMembers.sortOrder })
    .from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.createdAt));
  const idx = members.findIndex(m => m.id === memberId);
  const swapIdx = idx + direction;
  if (idx >= 0 && swapIdx >= 0 && swapIdx < members.length) {
    const a = members[idx];
    const b = members[swapIdx];
    await db.update(teamMembers).set({ sortOrder: b.sortOrder }).where(eq(teamMembers.id, a.id));
    await db.update(teamMembers).set({ sortOrder: a.sortOrder }).where(eq(teamMembers.id, b.id));
    revalidateTeam();
  }
  return await db.select({ id: teamMembers.id, sortOrder: teamMembers.sortOrder })
    .from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.createdAt));
}