"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { getOpenMailTodos, sendConfirmationMail } from "@/app/actions/reservations";

type Todo = Awaited<ReturnType<typeof getOpenMailTodos>>[number];

// ToDo-Liste: festgeschriebene Reservierungen, deren Bestätigungs-Mail noch nicht versendet wurde.
export default function AdminMailTodos() {
  const toast = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setTodos(await getOpenMailTodos());
    } catch {
      setTodos([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const send = async (id: string) => {
    setBusyId(id);
    try {
      const res = await sendConfirmationMail(id);
      if (res.warning) toast.showToast(res.warning, "warning");
      else toast.showToast("Bestätigungs-Mail versendet.", "success");
      await load();
    } catch (e) {
      toast.showToast(e instanceof Error ? e.message : "Mailversand fehlgeschlagen.", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (!loaded || todos.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-amber-800">⚠ ToDos: {todos.length} Bestätigungs-Mail(s) offen</h2>
        <p className="text-xs font-bold text-amber-700">Festgeschriebene Reservierungen ohne versendete Bestätigung.</p>
      </div>
      <div className="mt-3 space-y-2">
        {todos.map(t => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-2 text-sm font-bold">
            <span className="min-w-0 flex-1 truncate">
              {t.guestName} ({t.guestCount} P.) · {t.eventTitle ?? "Event"} · {new Date(t.reservationDate).toLocaleDateString("de-DE")}
            </span>
            <Link href={`/admin/events/${t.eventId}`} className="text-xs text-accent-green underline">Zum Event</Link>
            <button
              type="button"
              disabled={busyId === t.id}
              onClick={() => send(t.id)}
              className="min-h-9 rounded-lg bg-accent-green px-4 text-xs text-white hover:bg-base-dark disabled:opacity-50"
            >
              {busyId === t.id ? "Sendet…" : "Mail senden"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}