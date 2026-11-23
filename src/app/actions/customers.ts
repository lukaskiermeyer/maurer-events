"use server";

import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
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
  tags?: string[] | null;
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
  if (data.tags !== undefined) {
    const tags = Array.isArray(data.tags) ? data.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 20) : [];
    result.tags = tags;
  }
  return result;
}

export interface CustomerListFilters {
  query?: string;
  source?: string;
  consent?: "all" | "yes" | "no";
  hasEmail?: boolean | null;
  hasPhone?: boolean | null;
  tag?: string;
  sort?: "name" | "created" | "updated";
  page?: number;
  pageSize?: number;
}

export interface CustomerListResult {
  rows: typeof customers.$inferSelect[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getCustomers(filters: CustomerListFilters = {}): Promise<CustomerListResult> {
  await requireAdmin();
  const search = (filters.query || "").trim().slice(0, 100);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(filters.pageSize) || 50));
  const offset = (page - 1) * pageSize;

  const conditions: (ReturnType<typeof eq> | ReturnType<typeof isNull> | ReturnType<typeof or> | ReturnType<typeof gte> | ReturnType<typeof ilike> | ReturnType<typeof sql>)[] = [isNull(customers.deletedAt)];
  if (search) {
    conditions.push(or(
      ilike(customers.displayName, `%${search}%`),
      ilike(customers.company, `%${search}%`),
      ilike(customers.email, `%${search}%`),
      ilike(customers.phone, `%${search}%`),
      ilike(customers.city, `%${search}%`),
      ilike(customers.notes, `%${search}%`),
    ));
  }
  if (filters.source && filters.source !== "all") conditions.push(eq(customers.source, filters.source));
  if (filters.consent === "yes") conditions.push(eq(customers.marketingConsent, true));
  if (filters.consent === "no") conditions.push(eq(customers.marketingConsent, false));
  if (filters.hasEmail === true) conditions.push(isNotNull(customers.email), sql`trim(${customers.email}) <> ''`);
  if (filters.hasEmail === false) conditions.push(or(isNull(customers.email), sql`trim(coalesce(${customers.email}, '')) = ''`));
  if (filters.hasPhone === true) conditions.push(isNotNull(customers.phone), sql`trim(${customers.phone}) <> ''`);
  if (filters.hasPhone === false) conditions.push(or(isNull(customers.phone), sql`trim(coalesce(${customers.phone}, '')) = ''`));
  if (filters.tag && filters.tag !== "all") conditions.push(sql`${filters.tag} = ANY(${customers.tags})`);

  const where = and(...conditions);
  const orderBy = filters.sort === "created"
    ? desc(customers.createdAt)
    : filters.sort === "updated"
      ? desc(customers.updatedAt)
      : asc(customers.displayName);

  const [rows, countRows] = await Promise.all([
    db.select().from(customers).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customers).where(where),
  ]);
  return { rows, total: Number(countRows[0]?.count || 0), page, pageSize };
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

export async function findDuplicateCustomers(data: { displayName?: string; email?: string | null; phone?: string | null }) {
  await requireAdmin();
  const name = (data.displayName || "").trim();
  const email = normalizeEmail(data.email || "");
  const phone = (data.phone || "").trim();
  if (!name && !email && !phone) return [];
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof isNull> | ReturnType<typeof or> | ReturnType<typeof gte> | ReturnType<typeof ilike> | ReturnType<typeof sql>)[] = [isNull(customers.deletedAt)];
  const ors: (ReturnType<typeof eq> | ReturnType<typeof ilike>)[] = [];
  if (email) ors.push(eq(customers.email, email));
  if (phone) ors.push(eq(customers.phone, phone));
  if (name) ors.push(ilike(customers.displayName, name));
  if (ors.length) conditions.push(or(...ors));
  const rows = await db.select().from(customers).where(and(...conditions)).limit(10);
  return rows;
}

export async function exportCustomersCsv(filters: CustomerListFilters = {}) {
  await requireAdmin();
  // reuse filter logic by fetching all matching (up to 5000)
  const result = await getCustomers({ ...filters, page: 1, pageSize: 5000 });
  const header = ["Name", "Verein/Firma", "E-Mail", "Telefon", "Straße", "PLZ", "Ort", "Quelle", "Marketing-Einwilligung", "Tags", "Notizen", "Erstellt"];
  const lines = [header.join(";")];
  for (const c of result.rows) {
    const cells = [
      c.displayName, c.company, c.email, c.phone, c.street, c.zip, c.city, c.source,
      c.marketingConsent ? "ja" : "nein", (c.tags || []).join("|"), c.notes, c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "",
    ].map(value => `"${String(value ?? "").replace(/"/g, '""')}"`);
    lines.push(cells.join(";"));
  }
  return lines.join("\n");
}

export async function exportCustomerData(id: string) {
  await requireAdmin();
  uuid(id);
  const detail = await getCustomer(id);
  if (!detail) throw new BookingError("Kunde nicht gefunden.", 404);
  return {
    customer: detail.customer,
    reservations: detail.history.map(row => ({
      id: row.reservation.id,
      event: row.eventTitle,
      eventDate: row.eventDate,
      reservationDate: row.reservation.reservationDate,
      guestCount: row.reservation.guestCount,
      status: row.reservation.status,
      selectedTime: row.reservation.selectedTime,
      table: row.tableName,
    })),
    exportedAt: new Date().toISOString(),
  };
}

export async function anonymizeCustomer(id: string) {
  await requireAdmin();
  uuid(id);
  const [updated] = await db.update(customers).set({
    displayName: "Gelöschter Kunde",
    company: null,
    email: null,
    phone: null,
    street: null,
    zip: null,
    city: null,
    notes: null,
    marketingConsent: false,
    externalRef: null,
    externalSource: null,
    deletedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(customers.id, id)).returning();
  if (!updated) throw new BookingError("Kunde nicht gefunden.", 404);
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

export async function getDistinctCustomerTags() {
  await requireAdmin();
  const rows = await db.select({ tags: customers.tags }).from(customers).where(isNull(customers.deletedAt));
  const set = new Set<string>();
  for (const row of rows) for (const tag of row.tags || []) if (tag) set.add(tag);
  return Array.from(set).sort();
}

export async function getCustomerStats() {
  await requireAdmin();
  const rows = await db.select({
    customerId: reservations.customerId,
    guestCount: reservations.guestCount,
    amount: reservations.amountTotal,
  }).from(reservations).where(isNotNull(reservations.customerId));
  const agg = new Map<string, { guests: number; revenue: number; bookings: number }>();
  for (const row of rows) {
    if (!row.customerId) continue;
    const current = agg.get(row.customerId) || { guests: 0, revenue: 0, bookings: 0 };
    current.guests += row.guestCount || 0;
    current.revenue += row.amount || 0;
    current.bookings += 1;
    agg.set(row.customerId, current);
  }
  const top = Array.from(agg.entries())
    .sort((a, b) => b[1].guests - a[1].guests)
    .slice(0, 5);
  const ids = top.map(([id]) => id);
  const customerRows = ids.length ? await db.select().from(customers).where(inArray(customers.id, ids)) : [];
  const byId = new Map(customerRows.map(c => [c.id, c]));
  return top.map(([id, stats]) => ({ customer: byId.get(id) || null, ...stats }));
}