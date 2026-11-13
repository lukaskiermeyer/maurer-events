export interface StaffingRequirement {
  id: string;
  roleId: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  requiredCount: number;
  note?: string | null;
}

export interface StaffingAvailability {
  staffId: string;
  eventId: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  kind: "available" | "unavailable" | "preferred";
}

export interface StaffingPerson {
  id: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  status: string;
  employmentType: string;
  birthDate: Date | string | null;
  hourlyRateCents: number;
}

export interface StaffingRule {
  roleId: string;
  guestsPerStaff: number;
  minStaff: number;
  fixedStaff: number;
  maxHoursPerDay: number;
  minRestHours: number;
  minAge: number;
  active: boolean;
}

export interface StaffingAssignmentInput {
  id?: string;
  staffId: string;
  roleId: string;
  date: Date | string;
  startTime: string;
  endTime: string;
}

export interface PlannedAssignment extends StaffingAssignmentInput {
  status: "proposed";
  source: "auto";
  hours: number;
  costCents: number;
}

export interface StaffingGap {
  requirementId: string;
  roleId: string;
  date: string;
  startTime: string;
  endTime: string;
  missing: number;
  required: number;
  assigned: number;
}

export interface StaffingWarning {
  type: "no_availability" | "hours" | "rest" | "minor" | "role" | "inactive";
  staffId?: string;
  requirementId?: string;
  message: string;
}

export interface StaffingPlan {
  assignments: PlannedAssignment[];
  gaps: StaffingGap[];
  warnings: StaffingWarning[];
  costCents: number;
  coverage: number;
}

export function timeMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Ungültige Uhrzeit.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function shiftMinutes(start: string, end: string): number {
  const startMinutes = timeMinutes(start);
  let endMinutes = timeMinutes(end);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

export function shiftHours(start: string, end: string): number {
  return shiftMinutes(start, end) / 60;
}

export function shiftOverlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const startA = timeMinutes(aStart);
  let endA = timeMinutes(aEnd);
  if (endA <= startA) endA += 1440;
  const startB = timeMinutes(bStart);
  let endB = timeMinutes(bEnd);
  if (endB <= startB) endB += 1440;
  return startA < endB && startB < endA;
}

function dayKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function covers(availability: StaffingAvailability, requirement: StaffingRequirement) {
  if (availability.kind === "unavailable" || dayKey(availability.date) !== dayKey(requirement.date)) return false;
  const [availableStart, availableEnd] = timeRange(availability.startTime, availability.endTime);
  const [requiredStart, requiredEnd] = timeRange(requirement.startTime, requirement.endTime);
  return availableStart <= requiredStart && availableEnd >= requiredEnd;
}

function timeRange(start: string, end: string): [number, number] {
  const startMinutes = timeMinutes(start);
  let endMinutes = timeMinutes(end);
  if (endMinutes <= startMinutes) endMinutes += 1440;
  return [startMinutes, endMinutes];
}

function ageAt(birthDate: Date | string | null, date: Date | string) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const at = new Date(date);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const month = at.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export function demandFor(guests: number, rule: Pick<StaffingRule, "guestsPerStaff" | "minStaff" | "fixedStaff">) {
  const fromGuests = Math.ceil(Math.max(0, guests) / Math.max(1, rule.guestsPerStaff));
  return Math.max(0, rule.minStaff, fromGuests) + Math.max(0, rule.fixedStaff);
}

export function planStaffing(input: {
  eventId: string;
  requirements: StaffingRequirement[];
  availability: StaffingAvailability[];
  staff: StaffingPerson[];
  rules: StaffingRule[];
  existing?: StaffingAssignmentInput[];
  roleRates?: Record<string, number>;
}): StaffingPlan {
  const assignments: PlannedAssignment[] = [];
  const gaps: StaffingGap[] = [];
  const warnings: StaffingWarning[] = [];
  const eventId = input.eventId;
  const rules = new Map(input.rules.map(rule => [rule.roleId, rule]));
  const roleRates = input.roleRates || {};
  const allAssignments = [...(input.existing || [])];
  const assignedCount = new Map<string, number>();
  const dailyHours = new Map<string, number>();
  const dailyEnd = new Map<string, number>();

  for (const existing of input.existing || []) {
    const key = `${existing.staffId}|${dayKey(existing.date)}`;
    dailyHours.set(key, (dailyHours.get(key) || 0) + shiftHours(existing.startTime, existing.endTime));
    dailyEnd.set(key, Math.max(dailyEnd.get(key) || 0, timeMinutes(existing.endTime)));
  }

  // Scarcity-first: Schichten mit den wenigsten verfuegbaren Kandidaten zuerst zuteilen.
  const requirementOrder = [...input.requirements].sort((a, b) => {
    const countA = input.staff.filter(p => p.roleId === a.roleId && (p.status === "active" || p.status === "ready")).length;
    const countB = input.staff.filter(p => p.roleId === b.roleId && (p.status === "active" || p.status === "ready")).length;
    if (countA !== countB) return countA - countB;
    return shiftHours(a.startTime, a.endTime) - shiftHours(b.startTime, b.endTime);
  });

  for (const requirement of requirementOrder) {
    let assigned = 0;
    const rule = rules.get(requirement.roleId);
    if (!rule || !rule.active) {
      gaps.push({ requirementId: requirement.id, roleId: requirement.roleId, date: dayKey(requirement.date), startTime: requirement.startTime, endTime: requirement.endTime, missing: requirement.requiredCount, required: requirement.requiredCount, assigned: 0 });
      warnings.push({ type: "role", requirementId: requirement.id, message: "Für diese Rolle ist keine aktive Personalregel hinterlegt." });
      continue;
    }
    const candidates = input.staff
      .filter(person => person.roleId === requirement.roleId)
      .filter(person => person.status === "active" || person.status === "ready")
      .filter(person => {
        const age = ageAt(person.birthDate, requirement.date);
        if (age !== null && age < rule.minAge) {
          warnings.push({ type: "minor", staffId: person.id, requirementId: requirement.id, message: `${person.firstName} ${person.lastName} ist jünger als ${rule.minAge}.` });
          return false;
        }
        return true;
      })
      .filter(person => {
        const slots = input.availability.filter(item => item.staffId === person.id && item.eventId === eventId);
        if (!slots.length) {
          warnings.push({ type: "no_availability", staffId: person.id, requirementId: requirement.id, message: `${person.firstName} ${person.lastName} hat keine Verfügbarkeit hinterlegt.` });
          return false;
        }
        return slots.some(slot => covers(slot, requirement));
      })
      .filter(person => {
        const key = `${person.id}|${dayKey(requirement.date)}`;
        const hours = dailyHours.get(key) || 0;
        if (hours + shiftHours(requirement.startTime, requirement.endTime) > rule.maxHoursPerDay) {
          warnings.push({ type: "hours", staffId: person.id, requirementId: requirement.id, message: `${person.firstName} ${person.lastName} überschreitet die Tagesstunden.` });
          return false;
        }
        const lastEnd = dailyEnd.get(key);
        if (lastEnd !== undefined) {
          const gap = timeMinutes(requirement.startTime) - lastEnd;
          if (gap >= 0 && gap < rule.minRestHours * 60) {
            warnings.push({ type: "rest", staffId: person.id, requirementId: requirement.id, message: `${person.firstName} ${person.lastName} hat weniger als ${rule.minRestHours} h Ruhezeit.` });
            return false;
          }
        }
        return true;
      })
      .filter(person => !allAssignments.some(item => item.staffId === person.id
        && dayKey(item.date) === dayKey(requirement.date)
        && shiftOverlaps(item.startTime, item.endTime, requirement.startTime, requirement.endTime)))
      .sort((a, b) => {
        const loadA = assignedCount.get(a.id) || 0;
        const loadB = assignedCount.get(b.id) || 0;
        if (loadA !== loadB) return loadA - loadB;
        const preferredA = input.availability.some(item => item.staffId === a.id && item.kind === "preferred" && item.eventId === eventId && covers(item, requirement)) ? 1 : 0;
        const preferredB = input.availability.some(item => item.staffId === b.id && item.kind === "preferred" && item.eventId === eventId && covers(item, requirement)) ? 1 : 0;
        return preferredB - preferredA;
      });

    for (const person of candidates) {
      if (assigned >= requirement.requiredCount) break;
      const hours = shiftHours(requirement.startTime, requirement.endTime);
      const rate = person.hourlyRateCents || roleRates[requirement.roleId] || 0;
      const planned: PlannedAssignment = {
        staffId: person.id,
        roleId: requirement.roleId,
        date: requirement.date,
        startTime: requirement.startTime,
        endTime: requirement.endTime,
        status: "proposed",
        source: "auto",
        hours,
        costCents: Math.round(hours * rate),
      };
      assignments.push(planned);
      allAssignments.push(planned);
      assignedCount.set(person.id, (assignedCount.get(person.id) || 0) + 1);
      const key = `${person.id}|${dayKey(requirement.date)}`;
      dailyHours.set(key, (dailyHours.get(key) || 0) + hours);
      dailyEnd.set(key, Math.max(dailyEnd.get(key) || 0, timeMinutes(requirement.endTime)));
      assigned++;
    }

    if (assigned < requirement.requiredCount) {
      gaps.push({ requirementId: requirement.id, roleId: requirement.roleId, date: dayKey(requirement.date), startTime: requirement.startTime, endTime: requirement.endTime, missing: requirement.requiredCount - assigned, required: requirement.requiredCount, assigned });
    }
  }

  const totalRequired = input.requirements.reduce((sum, requirement) => sum + requirement.requiredCount, 0);
  const totalAssigned = assignments.length;
  return {
    assignments,
    gaps,
    warnings,
    costCents: assignments.reduce((sum, assignment) => sum + assignment.costCents, 0),
    coverage: totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100,
  };
}