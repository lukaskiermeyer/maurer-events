"use client";

import { useState } from "react";
import type { EventRecord, StaffAssignmentRecord, StaffRole } from "@/types/domain";
import { respondToAssignment, signUpForShift, withdrawSignup } from "@/app/actions/staffing";

type OpenOffer = {
  requirement: { id: string; eventId: string; roleId: string; date: Date | string; startTime: string; endTime: string; requiredCount: number; note: string | null };
  event: EventRecord;
  role: StaffRole | null;
  assigned: number;
  remaining: number;
  alreadySignedUp: boolean;
  conflict: boolean;
};

function dateParts(value: Date | string) {
  const d = new Date(value);
  return {
    weekday: d.toLocaleDateString("de-DE", { weekday: "short" }),
    day: d.toLocaleDateString("de-DE", { day: "2-digit" }),
    month: d.toLocaleDateString("de-DE", { month: "short" }),
  };
}

function isEnrolled(status: string) {
  return status === "requested" || status === "accepted" || status === "confirmed";
}

function DateBadge({ value, start, end, inverted }: { value: Date | string; start: string; end: string; inverted?: boolean }) {
  const { weekday, day, month } = dateParts(value);
  return (
    <div className={`shrink-0 w-20 sm:w-24 rounded-xl border text-center py-2 px-1 ${inverted ? "bg-white/10 border-white/20 text-white" : "bg-base-light border-border-light text-base-dark"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${inverted ? "text-white/70" : "text-base-dark/50"}`}>{weekday}</div>
      <div className="text-2xl sm:text-3xl font-display font-black leading-none mt-0.5">{day}</div>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${inverted ? "text-white/70" : "text-base-dark/50"}`}>{month}</div>
      <div className={`text-xs font-bold mt-1.5 tabular-nums ${inverted ? "text-white" : "text-base-dark"}`}>{start}–{end}</div>
    </div>
  );
}

export default function ShiftsList({ events, roles, initialAssignments, openOffers }: { events: EventRecord[]; roles: StaffRole[]; initialAssignments: StaffAssignmentRecord[]; openOffers: OpenOffer[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [offers, setOffers] = useState(openOffers);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const eventName = (id: string) => events.find(event => event.id === id)?.title || "Event";
  const roleName = (id: string) => roles.find(role => role.id === id)?.name || "—";

  const respond = async (id: string, status: "accepted" | "declined") => {
    setBusy(true); setMessage("");
    try {
      await respondToAssignment(id, status);
      setAssignments(current => current.map(assignment => assignment.id === id ? { ...assignment, status } : assignment));
      setMessage(status === "accepted" ? "Schicht angenommen." : "Schicht abgelehnt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden.");
    } finally { setBusy(false); }
  };

  const signup = async (requirementId: string) => {
    setBusy(true); setMessage("");
    try {
      await signUpForShift(requirementId);
      setMessage("Eingetragen – wartet auf Bestätigung durch den Festwirt.");
      setOffers(current => current.filter(o => o.requirement.id !== requirementId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Eintragen fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  const withdraw = async (assignmentId: string) => {
    setBusy(true); setMessage("");
    try {
      await withdrawSignup(assignmentId);
      setAssignments(current => current.filter(a => a.id !== assignmentId));
      setMessage("Eintragung zurückgezogen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Zurückziehen fehlgeschlagen.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Schichten</p>
          <h1 className="text-3xl font-display font-black text-base-dark">Meine Einsätze</h1>
          <p className="text-base-dark/60 mt-1">Bestätige vorgeschlagene Schichten oder trage dich selbst bei offenen Schichten ein.</p>
      <p className="mt-2"><a href="/api/team/ical" className="text-accent-green font-bold underline text-sm">📅 Schichten als Kalender (.ics) herunterladen</a></p>
        </div>
        <a href="/api/team/ical" className="inline-flex items-center gap-2 bg-white border border-border-light text-base-dark px-4 py-2 rounded-lg font-bold text-sm hover:bg-base-light transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          iCal exportieren
        </a>
      </div>
      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}

      {offers.length > 0 && (
        <section className="bg-white border border-border-light rounded-2xl p-5 space-y-3">
          <h2 className="font-display font-bold text-xl">Offene Schichten – eintragen</h2>
          <div className="space-y-2">
            {offers.map(o => (
              <article key={o.requirement.id} className="border border-border-light rounded-xl p-3 flex items-stretch gap-3">
                <DateBadge value={o.requirement.date} start={o.requirement.startTime} end={o.requirement.endTime} />
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p className="font-bold leading-tight">{o.event.title}</p>
                  <p className="text-sm text-base-dark/60 mt-0.5">{o.role?.name || "—"} · {o.event.location}</p>
                  {o.conflict && <p className="text-xs text-amber-700 mt-1">⚠️ Du bist zu dieser Zeit bereits verplant.</p>}
                </div>
                <div className="flex flex-col items-end justify-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30 px-2.5 py-1 text-xs font-bold" title="Eingetragen / Gesamt">
                      <span className="tabular-nums">{o.assigned}</span>
                      <span className="opacity-60">/</span>
                      <span className="tabular-nums">{o.requirement.requiredCount}</span>
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 text-xs font-bold tabular-nums" title="Freie Stellen">
                      {o.remaining} frei
                    </span>
                  </div>
                  <button type="button" disabled={busy || o.conflict} onClick={() => signup(o.requirement.id)} className="bg-accent-green text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Eintragen</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {assignments.length === 0 ? <p className="bg-white border border-border-light rounded-2xl p-6 text-base-dark/60">Noch keine Schichten eingeteilt.</p> : (
        <div className="space-y-2">{assignments.map(assignment => {
          const enrolled = isEnrolled(assignment.status);
          return (
            <article key={assignment.id} className={`rounded-2xl p-3 flex items-stretch gap-3 border-2 ${enrolled ? "bg-base-dark text-white border-base-dark" : "bg-white text-base-dark border-border-light"}`}>
              <DateBadge value={assignment.date} start={assignment.startTime} end={assignment.endTime} inverted={enrolled} />
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p className="font-bold leading-tight">{eventName(assignment.eventId)}</p>
                <p className={`text-sm mt-0.5 ${enrolled ? "text-white/70" : "text-base-dark/60"}`}>{roleName(assignment.roleId)}</p>
                <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${enrolled ? "text-white/60" : "text-base-dark/50"}`}>{assignment.status} · {assignment.source}</p>
              </div>
              <div className="flex flex-col items-end justify-center gap-2 shrink-0">
                {assignment.status === "proposed" && (
                  <>
                    <button type="button" disabled={busy} onClick={() => respond(assignment.id, "accepted")} className="bg-accent-green text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Annehmen</button>
                    <button type="button" disabled={busy} onClick={() => respond(assignment.id, "declined")} className="border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Ablehnen</button>
                  </>
                )}
                {assignment.source === "self" && assignment.status === "requested" && (
                  <button type="button" disabled={busy} onClick={() => withdraw(assignment.id)} className={`px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 ${enrolled ? "border border-white/40 text-white hover:bg-white/10" : "border border-red-200 text-red-700"}`}>Zurückziehen</button>
                )}
              </div>
            </article>
          );
        })}</div>
      )}
    </div>
  );
}
