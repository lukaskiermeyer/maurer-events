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
      setOffers(current => current.map(o => o.requirement.id === requirementId ? { ...o, alreadySignedUp: true, remaining: Math.max(0, o.remaining - 1) } : o));
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
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Schichten</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Meine Einsätze</h1>
        <p className="text-base-dark/60 mt-1">Bestätige vorgeschlagene Schichten oder trage dich selbst bei offenen Schichten ein.</p>
      </div>
      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}

      {offers.length > 0 && (
        <section className="bg-white border border-border-light rounded-2xl p-5 space-y-3">
          <h2 className="font-display font-bold text-xl">Offene Schichten – eintragen</h2>
          <div className="space-y-2">
            {offers.map(o => (
              <article key={o.requirement.id} className="border border-border-light rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{o.event.title}</p>
                  <p className="text-sm text-base-dark/60">{new Date(o.requirement.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })} · {o.requirement.startTime}–{o.requirement.endTime} · {o.role?.name || "—"} · {o.remaining} von {o.requirement.requiredCount} frei</p>
                  {o.conflict && <p className="text-xs text-amber-700 mt-1">⚠️ Überschneidung mit einer anderen deiner Schichten.</p>}
                </div>
                {o.alreadySignedUp ? (
                  <span className="text-xs font-bold text-accent-green">✓ Eingetragen</span>
                ) : (
                  <button type="button" disabled={busy || o.conflict} onClick={() => signup(o.requirement.id)} className="bg-accent-green text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Eintragen</button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {assignments.length === 0 ? <p className="bg-white border border-border-light rounded-2xl p-6 text-base-dark/60">Noch keine Schichten eingeteilt.</p> : (
        <div className="space-y-2">{assignments.map(assignment => (
          <article key={assignment.id} className="bg-white border border-border-light rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{eventName(assignment.eventId)}</p>
              <p className="text-sm text-base-dark/60">{new Date(assignment.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })} · {assignment.startTime}–{assignment.endTime} · {roleName(assignment.roleId)}</p>
              <p className="text-xs font-bold uppercase tracking-wider mt-1 text-base-dark/50">{assignment.status} · {assignment.source}</p>
            </div>
            <div className="flex gap-2">
              {assignment.status === "proposed" && (
                <>
                  <button type="button" disabled={busy} onClick={() => respond(assignment.id, "accepted")} className="bg-accent-green text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Annehmen</button>
                  <button type="button" disabled={busy} onClick={() => respond(assignment.id, "declined")} className="border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Ablehnen</button>
                </>
              )}
              {assignment.source === "self" && assignment.status === "requested" && (
                <button type="button" disabled={busy} onClick={() => withdraw(assignment.id)} className="border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Zurückziehen</button>
              )}
            </div>
          </article>
        ))}</div>
      )}
    </div>
  );
}