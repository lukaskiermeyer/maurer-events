"use client";

import { useState } from "react";
import type { EventRecord, StaffAssignmentRecord, StaffRole } from "@/types/domain";
import { respondToAssignment } from "@/app/actions/staffing";

export default function ShiftsList({ events, roles, initialAssignments }: { events: EventRecord[]; roles: StaffRole[]; initialAssignments: StaffAssignmentRecord[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Schichten</p>
        <h1 className="text-3xl font-display font-black text-base-dark">Meine Einsätze</h1>
        <p className="text-base-dark/60 mt-1">Bestätige oder lehne vorgeschlagene Schichten ab.</p>
      </div>
      {message && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{message}</p>}
      {assignments.length === 0 ? <p className="bg-white border border-border-light rounded-2xl p-6 text-base-dark/60">Noch keine Schichten eingeteilt.</p> : (
        <div className="space-y-2">{assignments.map(assignment => (
          <article key={assignment.id} className="bg-white border border-border-light rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{eventName(assignment.eventId)}</p>
              <p className="text-sm text-base-dark/60">{new Date(assignment.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })} · {assignment.startTime}–{assignment.endTime} · {roleName(assignment.roleId)}</p>
              <p className="text-xs font-bold uppercase tracking-wider mt-1 text-base-dark/50">{assignment.status}</p>
            </div>
            {assignment.status === "proposed" && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => respond(assignment.id, "accepted")} className="bg-accent-green text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Annehmen</button>
                <button type="button" disabled={busy} onClick={() => respond(assignment.id, "declined")} className="border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Ablehnen</button>
              </div>
            )}
          </article>
        ))}</div>
      )}
    </div>
  );
}