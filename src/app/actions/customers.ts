"use server";

import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customerImports, customers, events, reservations, tables } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { BookingError, uuid } from "@/lib/reservation-policy";
import { normalizeEmail, normalizeName, normalizePhone, type MappedCustomerRow } from "@/lib/customer-import";

export interface CustomerInput {
  displayName?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  notes?: string | null;
  marketingConsent?: boolean;
}

function text(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new BookingError(`Ungültige ${label}.`);
  return value.trim() || null;
}

function input(data: CustomerInput, requireName: boolean) {
  const result: Record<string, unknown> = {};
  if (data.displayName !== undefined) {
    const displayName = text(data.displayName, "Name", 150);
    if (!displayName) throw new BookingError("Name ist erforderlich.");
    result.displayName = displayName;
  } else if (requireName) {
    throw new BookingError("Name ist erforderlich.");
  }
  if (data.company !== undefined) result.company = text(data.company, "Firma", 150);
  if (data.email !== undefined) {
    const email = normalizeEmail(data.email);
    if (data.email && !email) throw new BookingError("Ungültige E-Mail-Adresse.");
    result.email = email;
  }
  if (data.phone !== undefined) result.phone = text(data.phone, "Telefon", 50);
  if (data.street !== undefined) result.street = text(data.street, "Straße", 150);
  if (data.zip !== undefined) result.zip = text(data.zip, "PLZ", 20);
  if (data.city !== undefined) result.city = text(data.city, "Ort", 100);
  if (data.notes !== undefined) result.notes = text(data.notes, "Notizen", 2000);
  if (data.marketingConsent !== undefined) result.marketingConsent = data.marketingConsent === true;
  return result;
}

export async function getCustomers(query = "") {
  await requireAdmin();
  const search = query.trim().slice(0, 100);
  const rows = await db.select().from(customers).where(and(
    isNull(customers.deletedAt),
    search ? or(ilike(customers.displayName, `%${search}%`), ilike(customers.company, `%${search}%`), ilike(customers.email, `%${search}%`), ilike(customers.phone, `%${search}%`)) : undefined,
  )).orderBy(customers.displayName).limit(500);
  return rows;
}

export async function getCustomer(id: string) {
  await requireAdmin();
  uuid(id);
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), isNull(customers.deletedAt)));
  if (!customer) return null;
  const history = await db.select({
    reservation: reservations,
    eventTitle: events.title,
    eventDate: events.date,
    tableName: tables.name,
  }).from(reservations)
    .leftJoin(events, eq(events.id, reservations.eventId))
    .leftJoin(tables, eq(tables.id, reservations.tableId))
    .where(eq(reservations.customerId, id))
    .orderBy(desc(reservations.reservationDate));
  return { customer, history };
}

export async function createCustomer(data: CustomerInput) {
  const staff = await requireAdmin();
  const clean = input(data, true);
  const [created] = await db.insert(customers).values({ ...(clean as typeof customers.$inferInsert), source: "manual" }).returning();
  revalidatePath("/[locale]/admin/kunden", "page");
  return { success: true, customer: created, actor: staff.email };
}

export async function updateCustomer(id: string, data: CustomerInput) {
  await requireAdmin();
  uuid(id);
  const clean = input(data, false);
  if (Object.keys(clean).length === 0) return { success: true };
  const [updated] = await db.update(customers).set({ ...(clean as Partial<typeof customers.$inferInsert>), updatedAt: new Date() }).where(eq(customers.id, id)).returning();
  if (!updated) throw new BookingError("Kunde nicht gefunden.", 404);
  revalidatePath("/[locale]/admin/kunden", "page");
  return { success: true, customer: updated };
}

export async function deleteCustomer(id: string) {
  await requireAdmin();
  uuid(id);
  await db.update(customers).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(customers.id, id));
  revalidatePath("/[locale]/admin/kunden", "page");
  return { success: true };
}

export async function importCustomers(payload: { fileName?: string; rows: MappedCustomerRow[] }) {
  const staff = await requireAdmin();
  if (!Array.isArray(payload?.rows) || payload.rows.length === 0 || payload.rows.length > 2000) {
    throw new BookingError("Import muss zwischen 1 und 2000 Zeilen enthalten.");
  }
  const fileName = typeof payload.fileName === "string" ? payload.fileName.slice(0, 200) : null;
  const errors: Array<{ row: number; message: string }> = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const result = await db.transaction(async tx => {
    const existing = await tx.select().from(customers).where(isNull(customers.deletedAt));
    const byEmail = new Map(existing.filter(customer => customer.email).map(customer => [customer.email!.toLowerCase(), customer]));
    const byPhoneName = new Map(existing.filter(customer => customer.phone).map(customer => [`${normalizePhone(customer.phone)}|${normalizeName(customer.displayName)}`, customer]));
    const byExternal = new Map(existing.filter(customer => customer.externalRef).map(customer => [`${customer.externalSource || ""}|${customer.externalRef}`, customer]));

    for (const raw of payload.rows) {
      const rowNumber = Number(raw.rowNumber || 0);
      const row = {
        displayName: raw.displayName || "",
        company: raw.company || "",
        email: raw.email || "",
        phone: raw.phone || "",
        street: raw.street || "",
        zip: raw.zip || "",
        city: raw.city || "",
        notes: raw.notes || "",
        externalRef: raw.externalRef || "",
      };
      const displayName = row.displayName.trim();
      const email = normalizeEmail(row.email);
      const phone = row.phone.trim();
      const externalRef = row.externalRef.trim();
      if (!displayName) { skippedCount++; errors.push({ row: rowNumber, message: "Name fehlt." }); continue; }
      if (row.email && !email) { skippedCount++; errors.push({ row: rowNumber, message: "Ungültige E-Mail." }); continue; }

      const key = externalRef ? `snapticket|${externalRef}` : "";
      const match = (key && byExternal.get(key))
        || (email ? byEmail.get(email) : undefined)
        || (phone ? byPhoneName.get(`${normalizePhone(phone)}|${normalizeName(displayName)}`) : undefined);

      const values = {
        displayName,
        company: row.company?.trim() || null,
        email,
        phone: phone || null,
        street: row.street?.trim() || null,
        zip: row.zip?.trim() || null,
        city: row.city?.trim() || null,
        notes: row.notes?.trim() || null,
        source: "snapticket" as const,
        externalRef: externalRef || null,
        externalSource: externalRef ? "snapticket" : null,
      };

      if (match) {
        const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== "")) as Partial<typeof values>;
        const [updated] = await tx.update(customers).set({ ...updates, updatedAt: new Date() }).where(eq(customers.id, match.id)).returning();
        if (updated.email) byEmail.set(updated.email.toLowerCase(), updated);
        if (updated.phone) byPhoneName.set(`${normalizePhone(updated.phone)}|${normalizeName(updated.displayName)}`, updated);
        if (updated.externalRef) byExternal.set(`snapticket|${updated.externalRef}`, updated);
        updatedCount++;
      } else {
        const [inserted] = await tx.insert(customers).values(values).returning();
        if (inserted.email) byEmail.set(inserted.email.toLowerCase(), inserted);
        if (inserted.phone) byPhoneName.set(`${normalizePhone(inserted.phone)}|${normalizeName(inserted.displayName)}`, inserted);
        if (inserted.externalRef) byExternal.set(`snapticket|${inserted.externalRef}`, inserted);
        createdCount++;
      }
    }

    const [log] = await tx.insert(customerImports).values({
      fileName,
      importedBy: staff.email,
      rowCount: payload.rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      report: { errors: errors.slice(0, 100) },
    }).returning();
    return log;
  });

  revalidatePath("/[locale]/admin/kunden", "page");
  return { success: true, created: createdCount, updated: updatedCount, skipped: skippedCount, errors, importId: result.id };
}