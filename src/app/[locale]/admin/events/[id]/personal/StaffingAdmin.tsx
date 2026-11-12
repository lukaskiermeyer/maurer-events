"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { EventRecord, EventStaffRequirementRecord, StaffAssignmentRecord, StaffAvailabilityRecord, StaffRecord, StaffRole, StaffingRuleRecord } from "@/types/domain";
import { autoAssign, confirmAssignment, deleteRequirement, saveRequirement, saveStaffingRule } from "@/app/actions/staffing";
import { formatEuroCents } from "@/lib/pricing";
import type { StaffingPlan } from "@/lib/staffing";

type Data = {
  event: EventRecord;
  roles: StaffRole[];
  team: Array<{ member: StaffRecord; role: StaffRole | null }>;
  rules: StaffingRuleRecord[];
  requirements: EventStaffRequirementRecord[];
  availability: StaffAvailabilityRecord[];
  assignments: StaffAssignmentRecord[];
};

function day(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
function dateLabel(value: Date | string) {
  return new Date(value).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function RuleRow({ role, rule }: { role: StaffRole; rule?: StaffingRuleRecord }) {
  const [form, setForm] = useState({
    guestsPerStaff: rule?.guestsPerStaff ?? 40,
    minStaff: rule?.minStaff ?? 1,
    fixedStaff: rule?.fixedStaff ?? 0,
    maxHoursPerDay: rule?.maxHoursPerDay ?? 10,
    minRestHours: rule?.minRestHours ?? 11,
    minAge: rule?.minAge ?? 18,
    active: rule?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await saveStaffingRule(role.id, form); } finally { setBusy(false); }
  };
  return (
    <tr className="border-t border-border-light">
      <td className="px-3 py-2 font-bold">{role.name}</td>
      <td className="px-2 py-2"><input type="number" min={1} value={form.guestsPerStaff} onChange={event => setForm({ ...form, guestsPerStaff: Number(event.target.value) })} className="w-20 bg-white border border-border-light rounded p-1 text-sm" /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={form.minStaff} onChange={event => setForm({ ...form, minStaff: Number(event.target.value) })} className="w-16 bg-white border border-border-light rounded p-1 text-sm" /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={form.fixedStaff} onChange={event => setForm({ ...form, fixedStaff: Number(event.target.value) })} className="w-16 bg-white border border-border-light rounded p-1 text-sm" /></td>
      <td className="px-2 py-2"><input type="number" min={1} max={24} value={form.maxHoursPerDay} onChange={event => setForm({ ...form, maxHoursPerDay: Number(event.target.value) })} className="w-16 bg-white border border-border-light rounded p-1 text-sm" /></td>
      <td className="px-2 py-2"><input type="number" min={0} max={24} value={form.minRestHours} onChange={event => setForm({ ...form, minRestHours: Number(event.target.value) })} className="w-16 bg-white border border-border-light rounded p-1 text-sm" /></td>
      <td className="px-2 py-2"><button type="button" onClick={save} disabled={busy} className="text-accent-green font-bold text-sm disabled:opacity-50">Speichern</button></td>
    </tr>
  );
}

export default function StaffingAdmin({ data }: { data: Data }) {
  const router = useRouter();
  const [date, setDate] = useState(day(data.event.date));
  const [form, setForm] = useState({ roleId: data.roles[0]?.id || "", date: day(data.event.date), startTime: "16:00", endTime: "23:00", requiredCount: 1, note: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<StaffingPlan | null>(null);
  const roleName = (id: string) => data.roles.find(role => role.id === id)?.name || "—";
  const staffName = (id: string) => {
    const person = data.team.find(item => item.member.id === id)?.member;
    return person ? `${person.firstName} ${person.lastName}` : "—";
  };

  const addRequirement = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await saveRequirement(data.event.id, form);
      setMessage("Personalbedarf gespeichert.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const removeRequirement = async (id: string) => {
    if (!confirm("Personalbedarf wirklich löschen?")) return;
    setBusy(true);
    try { await deleteRequirement(id); router.refresh(); }
    finally { setBusy(false); }
  };

  const runAutoAssign = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await autoAssign(data.event.id, date);
      setPlan(result.plan);
      setMessage(`Zuweisung berechnet: ${result.plan.assignments.length} Schichten, ${result.plan.gaps.length} Lücken.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const confirm = async (id: string) => {
    setBusy(true);
    try { await confirmAssignment(id); router.refresh(); }
    finally { setBusy(false); }
  };

  const requirementsForDate = data.requirements.filter(requirement => day(requirement.date) === date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/events/${data.event.id}`} className="text-sm font-bold uppercase tracking-widest text-accent-green hover:underline">&larr; Zurück zum Event</Link>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-base-dark mt-2">Personalplanung</h1>
          <p className="text-base-dark/60">{data.event.title} · {data.team.length} aktive Mitarbeiter</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={event => setDate(event.target.value)} className="min-h-12 bg-white border border-border-light rounded-xl px-3" />
          <button type="button" onClick={runAutoAssign} disabled={busy} className="min-h-12 px-5 bg-accent-green text-white rounded-xl font-bold disabled:opacity-50">Automatisch zuweisen</button>
        </div>
      </div>

      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}

      {plan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{plan.coverage}%</div><div className="text-xs uppercase font-bold opacity-50">Abdeckung</div></div>
          <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{plan.assignments.length}</div><div className="text-xs uppercase font-bold opacity-50">Zuweisungen</div></div>
          <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-amber-700">{plan.gaps.reduce((sum, gap) => sum + gap.missing, 0)}</div><div className="text-xs uppercase font-bold opacity-50">Fehlende Personen</div></div>
          <div className="bg-white border border-border-light rounded-xl p-4"><div className="text-2xl font-black text-accent-green">{formatEuroCents(plan.costCents)}</div><div className="text-xs uppercase font-bold opacity-50">Personalkosten</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={addRequirement} className="bg-white border border-border-light rounded-2xl p-5 space-y-3 h-fit">
          <h2 className="font-display font-bold text-xl">Personalbedarf</h2>
          <select required value={form.roleId} onChange={event => setForm({ ...form, roleId: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3">
            <option value="">Rolle wählen</option>
            {data.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
          <div className="grid grid-cols-2 gap-3"><input type="time" required value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /><input type="time" required value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" /></div>
          <div className="flex items-center gap-3"><span className="text-sm font-bold">Personen</span><input type="number" min={1} value={form.requiredCount} onChange={event => setForm({ ...form, requiredCount: Number(event.target.value) })} className="w-24 bg-base-light border border-border-light rounded-lg p-3" /></div>
          <input placeholder="Notiz (optional)" value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="w-full bg-base-light border border-border-light rounded-lg p-3" />
          <button type="submit" disabled={busy} className="w-full bg-accent-green text-white py-3 rounded-xl font-bold disabled:opacity-50">Bedarf hinzufügen</button>
        </form>

        <section className="lg:col-span-2 bg-white border border-border-light rounded-2xl overflow-hidden">
          <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Bedarf am {dateLabel(date)}</h2>
          {requirementsForDate.length === 0 ? <p className="p-6 text-base-dark/60">Noch kein Personalbedarf für diesen Tag.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Schicht</th><th className="px-4 py-3">Benötigt</th><th className="px-4 py-3">Zugewiesen</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>{requirementsForDate.map(requirement => {
                const assigned = data.assignments.filter(assignment => assignment.roleId === requirement.roleId && day(assignment.date) === day(requirement.date) && assignment.startTime === requirement.startTime).length;
                return <tr key={requirement.id} className="border-t border-border-light"><td className="px-4 py-3 font-bold">{roleName(requirement.roleId)}</td><td className="px-4 py-3">{requirement.startTime}–{requirement.endTime}</td><td className="px-4 py-3">{requirement.requiredCount}</td><td className={`px-4 py-3 font-bold ${assigned < requirement.requiredCount ? "text-amber-700" : "text-accent-green"}`}>{assigned}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeRequirement(requirement.id)} className="text-red-600 font-bold">Löschen</button></td></tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
      </div>

      {plan && (plan.gaps.length > 0 || plan.warnings.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h2 className="font-display font-bold text-xl text-amber-900 mb-3">Lücken & Hinweise</h2>
          {plan.gaps.map(gap => <p key={`${gap.requirementId}-${gap.startTime}`} className="text-sm font-bold text-amber-900">{roleName(gap.roleId)} · {gap.startTime}–{gap.endTime}: {gap.missing} fehlen ({gap.assigned}/{gap.required}).</p>)}
          {plan.warnings.slice(0, 12).map((warning, index) => <p key={index} className="text-xs text-amber-800 mt-1">{warning.message}</p>)}
        </div>
      )}

      <section className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <h2 className="font-display font-bold text-xl p-5 border-b border-border-light">Einteilung ({data.assignments.length})</h2>
        {data.assignments.length === 0 ? <p className="p-6 text-base-dark/60">Noch keine Einteilung.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Datum</th><th className="px-4 py-3">Mitarbeiter</th><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Schicht</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{data.assignments.map(assignment => (
              <tr key={assignment.id} className="border-t border-border-light"><td className="px-4 py-3">{dateLabel(assignment.date)}</td><td className="px-4 py-3 font-bold">{staffName(assignment.staffId)}</td><td className="px-4 py-3">{roleName(assignment.roleId)}</td><td className="px-4 py-3">{assignment.startTime}–{assignment.endTime}</td><td className="px-4 py-3">{assignment.status}</td><td className="px-4 py-3 text-right">{assignment.status !== "confirmed" && <button type="button" onClick={() => confirm(assignment.id)} className="text-accent-green font-bold">Bestätigen</button>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="bg-white border border-border-light rounded-2xl p-5 overflow-x-auto">
        <h2 className="font-display font-bold text-xl mb-3">Personalschlüssel</h2>
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-canvas-light text-left"><tr><th className="px-3 py-2">Rolle</th><th className="px-2 py-2">Gäste/Person</th><th className="px-2 py-2">Min.</th><th className="px-2 py-2">Fix</th><th className="px-2 py-2">Max. h/Tag</th><th className="px-2 py-2">Ruhe h</th><th></th></tr></thead>
          <tbody>{data.roles.map(role => <RuleRow key={role.id} role={role} rule={data.rules.find(rule => rule.roleId === role.id)} />)}</tbody>
        </table>
      </section>
    </div>
  );
}