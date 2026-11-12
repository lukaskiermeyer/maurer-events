"use server";

import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { events, eventStaffRequirements, staff, staffAssignments, staffAvailability, staffRoles, staffingRules } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { requireStaffMember } from "@/lib/staff-auth";
import { BookingError, calendarDate, cleanTime, uuid } from "@/lib/reservation-policy";
import { demandFor, planStaffing, shiftHours, type StaffingAssignmentInput } from "@/lib/staffing";
import { audit } from "@/lib/audit";

function int(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new BookingError(`Ungültige ${label}.`);
  return value;
}

export async function getStaffingData(eventId: string) {
  await requireAdmin();
  uuid(eventId);
  const [event] = await db.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt)));
  if (!event) throw new BookingError("Event nicht gefunden.", 404);
  const [roles, team, rules, requirements, availability, assignments] = await Promise.all([
    db.select().from(staffRoles).where(eq(staffRoles.active, true)).orderBy(asc(staffRoles.name)),
    db.select({ member: staff, role: staffRoles }).from(staff).leftJoin(staffRoles, eq(staffRoles.id, staff.roleId)).where(and(isNull(staff.exitDate), inArray(staff.status, ["active", "ready"]))).orderBy(asc(staff.lastName)),
    db.select().from(staffingRules),
    db.select().from(eventStaffRequirements).where(eq(eventStaffRequirements.eventId, eventId)).orderBy(asc(eventStaffRequirements.date), asc(eventStaffRequirements.startTime)),
    db.select().from(staffAvailability).where(eq(staffAvailability.eventId, eventId)).orderBy(asc(staffAvailability.date), asc(staffAvailability.startTime)),
    db.select().from(staffAssignments).where(eq(staffAssignments.eventId, eventId)).orderBy(asc(staffAssignments.date), asc(staffAssignments.startTime)),
  ]);
  return { event, roles, team, rules, requirements, availability, assignments };
}

export async function saveStaffingRule(roleId: string, data: { guestsPerStaff: number; minStaff: number; fixedStaff: number; maxHoursPerDay: number; minRestHours: number; minAge: number; active?: boolean }) {
  await requireAdmin();
  uuid(roleId);
  const values = {
    guestsPerStaff: int(data.guestsPerStaff, 1, 10000, "Gäste pro Person"),
    minStaff: int(data.minStaff, 0, 500, "Minimalbesetzung"),
    fixedStaff: int(data.fixedStaff, 0, 500, "Fixbesetzung"),
    maxHoursPerDay: int(data.maxHoursPerDay, 1, 24, "Tagesstunden"),
    minRestHours: int(data.minRestHours, 0, 24, "Ruhezeit"),
    minAge: int(data.minAge, 0, 100, "Mindestalter"),
    active: data.active !== false,
    updatedAt: new Date(),
  };
  const [saved] = await db.insert(staffingRules).values({ roleId, ...values }).onConflictDoUpdate({ target: staffingRules.roleId, set: values }).returning();
  revalidatePath("/[locale]/admin", "layout");
  return { success: true, rule: saved };
}

export async function saveRequirement(eventId: string, data: { roleId: string; date: string; startTime: string; endTime: string; requiredCount: number; note?: string }) {
  await requireAdmin();
  uuid(eventId); uuid(data.roleId, "Rolle");
  const day = calendarDate(data.date);
  const startTime = cleanTime(data.startTime);
  const endTime = cleanTime(data.endTime);
  const requiredCount = int(data.requiredCount, 1, 500, "Anzahl");
  if (shiftHours(startTime, endTime) <= 0 || shiftHours(startTime, endTime) > 24) throw new BookingError("Ungültige Schichtdauer.");
  const [created] = await db.insert(eventStaffRequirements).values({ eventId, roleId: data.roleId, date: day, startTime, endTime, requiredCount, note: data.note?.trim().slice(0, 500) || null }).returning();
  revalidatePath("/[locale]/admin", "layout");
  return { success: true, requirement: created };
}

export async function deleteRequirement(id: string) {
  await requireAdmin(); uuid(id);
  await db.delete(eventStaffRequirements).where(eq(eventStaffRequirements.id, id));
  revalidatePath("/[locale]/admin", "layout");
  return { success: true };
}

export async function suggestRequirements(eventId: string, data: { date: string; startTime: string; endTime: string; guests?: number }) {
  await requireAdmin();
  uuid(eventId);
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new BookingError("Event nicht gefunden.", 404);
  const [roles, rules] = await Promise.all([db.select().from(staffRoles).where(eq(staffRoles.active, true)), db.select().from(staffingRules)]);
  const guests = int(data.guests ?? (event.expectedGuests || event.maxCapacity || 0), 0, 1000000, "Gästezahl");
  const ruleMap = new Map(rules.map(rule => [rule.roleId, rule]));
  return roles.map(role => {
    const rule = ruleMap.get(role.id);
    return {
      roleId: role.id,
      roleName: role.name,
      requiredCount: rule ? demandFor(guests, rule) : 0,
      rule: rule || null,
      date: data.date,
      startTime: cleanTime(data.startTime),
      endTime: cleanTime(data.endTime),
    };
  }).filter(row => row.requiredCount > 0);
}

export async function autoAssign(eventId: string, date?: string) {
  await requireAdmin();
  uuid(eventId);
  const data = await getStaffingData(eventId);
  const selectedDate = date ? calendarDate(date) : null;
  const requirements = data.requirements.filter(requirement => !selectedDate || new Date(requirement.date).toISOString().slice(0, 10) === selectedDate.toISOString().slice(0, 10));
  const existing = data.assignments
    .filter(assignment => !(assignment.source === "auto" && assignment.status === "proposed"))
    .map(assignment => ({
      id: assignment.id, staffId: assignment.staffId, roleId: assignment.roleId,
      date: assignment.date, startTime: assignment.startTime, endTime: assignment.endTime,
    })) as StaffingAssignmentInput[];
  const plan = planStaffing({
    eventId,
    requirements: requirements.map(requirement => ({ id: requirement.id, roleId: requirement.roleId, date: requirement.date, startTime: requirement.startTime, endTime: requirement.endTime, requiredCount: requirement.requiredCount })),
    availability: data.availability.map(item => ({ staffId: item.staffId, eventId: item.eventId, date: item.date, startTime: item.startTime, endTime: item.endTime, kind: item.kind as "available" | "unavailable" | "preferred" })),
    staff: data.team.map(({ member }) => ({ id: member.id, firstName: member.firstName, lastName: member.lastName, roleId: member.roleId, status: member.status, employmentType: member.employmentType, birthDate: member.birthDate, hourlyRateCents: member.hourlyRateCents })),
    rules: data.rules.map(rule => ({ roleId: rule.roleId, guestsPerStaff: rule.guestsPerStaff, minStaff: rule.minStaff, fixedStaff: rule.fixedStaff, maxHoursPerDay: rule.maxHoursPerDay, minRestHours: rule.minRestHours, minAge: rule.minAge, active: rule.active })),
    existing,
    roleRates: Object.fromEntries(data.roles.map(role => [role.id, role.hourlyRateCents])),
  });
  await db.transaction(async tx => {
    const old = data.assignments.filter(assignment => assignment.source === "auto" && assignment.status === "proposed" && (!selectedDate || new Date(assignment.date).toISOString().slice(0, 10) === selectedDate.toISOString().slice(0, 10)));
    for (const assignment of old) await tx.delete(staffAssignments).where(eq(staffAssignments.id, assignment.id));
    if (plan.assignments.length > 0) {
      await tx.insert(staffAssignments).values(plan.assignments.map(assignment => ({
        eventId, staffId: assignment.staffId, roleId: assignment.roleId, date: new Date(assignment.date),
        startTime: assignment.startTime, endTime: assignment.endTime, status: "proposed", source: "auto",
      })));
    }
  });
  await audit("admin", "staffing", "staffing.auto_assign", "event", eventId, { date: date || null, assignments: plan.assignments.length, gaps: plan.gaps.length });
  revalidatePath("/[locale]/admin", "layout");
  return { success: true, plan };
}

export async function deleteAssignment(id: string) {
  await requireAdmin(); uuid(id);
  await db.delete(staffAssignments).where(eq(staffAssignments.id, id));
  revalidatePath("/[locale]/admin", "layout");
  return { success: true };
}

export async function confirmAssignment(id: string) {
  await requireAdmin(); uuid(id);
  await db.update(staffAssignments).set({ status: "confirmed", updatedAt: new Date() }).where(eq(staffAssignments.id, id));
  revalidatePath("/[locale]/admin", "layout");
  return { success: true };
}

export async function saveMyAvailability(eventId: string, data: { date: string; startTime: string; endTime: string; kind: "available" | "unavailable" | "preferred"; note?: string }) {
  const member = await requireStaffMember();
  uuid(eventId);
  const day = calendarDate(data.date);
  const startTime = cleanTime(data.startTime);
  const endTime = cleanTime(data.endTime);
  if (!["available", "unavailable", "preferred"].includes(data.kind)) throw new BookingError("Ungültige Verfügbarkeit.");
  const [created] = await db.insert(staffAvailability).values({ staffId: member.id, eventId, date: day, startTime, endTime, kind: data.kind, note: data.note?.trim().slice(0, 500) || null }).returning();
  revalidatePath("/[locale]/team", "layout");
  return { success: true, availability: created };
}

export async function deleteMyAvailability(id: string) {
  const member = await requireStaffMember();
  uuid(id);
  await db.delete(staffAvailability).where(and(eq(staffAvailability.id, id), eq(staffAvailability.staffId, member.id)));
  revalidatePath("/[locale]/team", "layout");
  return { success: true };
}

export async function getMyStaffing() {
  const member = await requireStaffMember(true);
  const today = new Date();
  const [upcoming, availability, assignments, roles] = await Promise.all([
    db.select().from(events).where(and(gte(events.date, today), isNull(events.deletedAt), eq(events.type, "event"))).orderBy(asc(events.date)),
    db.select().from(staffAvailability).where(eq(staffAvailability.staffId, member.id)).orderBy(asc(staffAvailability.date)),
    db.select().from(staffAssignments).where(eq(staffAssignments.staffId, member.id)).orderBy(asc(staffAssignments.date), asc(staffAssignments.startTime)),
    db.select().from(staffRoles).orderBy(asc(staffRoles.name)),
  ]);
  return { member, upcoming, availability, assignments, roles };
}

export async function respondToAssignment(id: string, status: "accepted" | "declined") {
  const member = await requireStaffMember();
  uuid(id);
  if (status !== "accepted" && status !== "declined") throw new BookingError("Ungültiger Status.");
  const [updated] = await db.update(staffAssignments).set({ status, updatedAt: new Date() }).where(and(eq(staffAssignments.id, id), eq(staffAssignments.staffId, member.id), eq(staffAssignments.status, "proposed"))).returning();
  if (!updated) throw new BookingError("Schicht nicht gefunden oder bereits beantwortet.", 404);
  revalidatePath("/[locale]/team", "layout");
  return { success: true };
}