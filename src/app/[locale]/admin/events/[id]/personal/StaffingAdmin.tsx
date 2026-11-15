"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { EventRecord, EventStaffRequirementRecord, StaffAssignmentRecord, StaffAvailabilityRecord, StaffRecord, StaffRole } from "@/types/domain";
import { autoAssign, confirmAssignment, declineAssignment, deleteRequirement, saveRequirement } from "@/app/actions/staffing";
import { formatEuroCents } from "@/lib/pricing";
import type { StaffingPlan } from "@/lib/staffing";

type Data = {
  event: EventRecord;
  roles: StaffRole[];
  team: Array<{ member: StaffRecord; role: StaffRole | null }>;
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

  const confirmShift = async (id: string) => {
    setBusy(true);
    try { await confirmAssignment(id); router.refresh(); }
    finally { setBusy(false); }
  };
  const decline = async (id: string) => {
    if (!window.confirm("Schicht wirklich ablehnen?")) return;
    setBusy(true);
    try { await declineAssignment(id); router.refresh(); }
    finally { setBusy(false); }
  };

  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const filteredAssignments = data.assignments.filter(assignment => {
    if (filterRole && assignment.roleId !== filterRole) return false;
    if (filterStatus && assignment.status !== filterStatus) return false;
    if (filterSearch && !staffName(assignment.staffId).toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const eventDays = (() => {
    const days = new Set<string>();
    if (Array.isArray(data.event.reservableDates) && data.event.reservableDates.length > 0) {
      for (const d of data.event.reservableDates) days.add(String(d).slice(0, 10));
    } else {
      const start = new Date(data.event.date);
      const end = data.event.endDate ? new Date(data.event.endDate) : start;
      const cur = new Date(start);
      while (cur <= end) {
        days.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
    // Tage mit Bedarf auch aufnehmen
    for (const r of data.requirements) days.add(day(r.date));
    return Array.from(days).sort();
  })();

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
          {eventDays.length > 1 ? (
            <div className="flex flex-wrap gap-1 bg-base-light/80 border border-border-light rounded-full p-1">
              {eventDays.map(d => (
                <button key={d} type="button" onClick={() => { setDate(d); setForm(prev => ({ ...prev, date: d })); }} className={`min-h-10 px-3 rounded-full text-sm font-bold transition-all ${date === d ? "bg-accent-green text-white shadow-md" : "text-base-dark/55 hover:bg-white"}`}>
                  {new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </button>
              ))}
            </div>
          ) : (
            <input type="date" value={date} onChange={event => { setDate(event.target.value); setForm(prev => ({ ...prev, date: event.target.value })); }} className="min-h-12 bg-white border border-border-light rounded-xl px-3" />
          )}
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

      {requirementsForDate.length > 0 && (
        <section className="bg-white border border-border-light rounded-2xl p-5">
          <h2 className="font-display font-bold text-xl mb-3">Abdeckung am {dateLabel(date)}</h2>
          <div className="space-y-3">
            {requirementsForDate.map(requirement => {
              const assigned = data.assignments.filter(a => a.roleId === requirement.roleId && day(a.date) === day(requirement.date) && a.startTime === requirement.startTime).length;
              const pct = requirement.requiredCount > 0 ? Math.min(100, Math.round((assigned / requirement.requiredCount) * 100)) : 100;
              return (
                <div key={requirement.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold">{roleName(requirement.roleId)} · {requirement.startTime}–{requirement.endTime}</span>
                    <span className={assigned < requirement.requiredCount ? "text-amber-700 font-bold" : "text-accent-green font-bold"}>{assigned}/{requirement.requiredCount}</span>
                  </div>
                  <div className="w-full bg-canvas-light rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full transition-all ${assigned < requirement.requiredCount ? "bg-amber-400" : "bg-accent-green"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border-light flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-bold text-xl">Einteilung ({filteredAssignments.length}{filteredAssignments.length !== data.assignments.length ? ` von ${data.assignments.length}` : ""})</h2>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Name suchen…" value={filterSearch} onChange={event => setFilterSearch(event.target.value)} className="min-h-10 bg-base-light border border-border-light rounded-lg px-3 text-sm" />
            <select value={filterRole} onChange={event => setFilterRole(event.target.value)} className="min-h-10 bg-base-light border border-border-light rounded-lg px-3 text-sm">
              <option value="">Alle Rollen</option>
              {data.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="min-h-10 bg-base-light border border-border-light rounded-lg px-3 text-sm">
              <option value="">Alle Status</option>
              <option value="proposed">Vorgeschlagen</option>
              <option value="requested">Selbst eingetragen</option>
              <option value="accepted">Angenommen</option>
              <option value="declined">Abgelehnt</option>
              <option value="confirmed">Bestätigt</option>
            </select>
            {(filterRole || filterStatus || filterSearch) && <button type="button" onClick={() => { setFilterRole(""); setFilterStatus(""); setFilterSearch(""); }} className="min-h-10 px-3 text-sm font-bold text-accent-green">Zurücksetzen</button>}
          </div>
        </div>
        {filteredAssignments.length === 0 ? <p className="p-6 text-base-dark/60">Keine passenden Einträge.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-canvas-light text-left"><tr><th className="px-4 py-3">Datum</th><th className="px-4 py-3">Mitarbeiter</th><th className="px-4 py-3">Rolle</th><th className="px-4 py-3">Schicht</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{filteredAssignments.map(assignment => (
              <tr key={assignment.id} className="border-t border-border-light"><td className="px-4 py-3">{dateLabel(assignment.date)}</td><td className="px-4 py-3 font-bold">{staffName(assignment.staffId)}</td><td className="px-4 py-3">{roleName(assignment.roleId)}</td><td className="px-4 py-3">{assignment.startTime}–{assignment.endTime}</td><td className="px-4 py-3">{assignment.status}{assignment.source === "self" ? " (selbst)" : ""}</td><td className="px-4 py-3 text-right">
  {assignment.status !== "confirmed" && assignment.status !== "declined" && (
    <div className="flex gap-2 justify-end">
      <button type="button" onClick={() => confirmShift(assignment.id)} className="text-accent-green font-bold">Bestätigen</button>
      <button type="button" onClick={() => decline(assignment.id)} className="text-red-600 font-bold">Ablehnen</button>
    </div>
  )}
</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

    </div>
  );
}