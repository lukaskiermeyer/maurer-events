// Korrektheitstest für Contention + Idempotency.
// Ausführung: npm run test:concurrency (anpassen) oder tsx scripts/...
// Voraussetzung: lokale Test-DB auf 127.0.0.1:55439 (siehe reservation-security-test.ts).
//
// Invarianten:
// 1) 50 parallele Buchungen auf denselben Schicht-Slot:
//    - genau 1 Erfolg (HTTP 200/201 oder DB-Insert)
//    - Rest HTTP 409 (Conflict)
//    - DB-Count für diesen Slot == 1
// 2) Gleicher Idempotency-Key zweimal:
//    - 1 Datensatz (kein Duplikat)
//    - zweite Antwort liefert denselben Datensatz (idempotent)

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

// TODO: an das konkrete Checkout-Service anbinden (createCheckoutService).
// Pseudo-Code:
test('contention: 50 parallele Buchungen -> genau 1 Erfolg', async () => {
  const slot = `contended-${randomUUID()}`;
  const N = 50;
  const results = await Promise.allSettled(
    Array.from({ length: N }, (_, i) =>
      fetch('http://127.0.0.1:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'loadtest-event',
          day: '2026-12-02',
          guestCount: 2,
          tableId: slot,
          selectedTime: '20:00',
          idempotencyKey: `contention-${i}`,
        }),
      }).then((r) => r.status)
    )
  );
  const successes = results.filter((r) => r.status === 'fulfilled' && (r.value === 200 || r.value === 201)).length;
  const conflicts = results.filter((r) => r.status === 'fulfilled' && r.value === 409).length;
  assert.equal(successes, 1, `expected 1 success, got ${successes}`);
  assert.equal(conflicts, N - 1, `expected ${N - 1} conflicts, got ${conflicts}`);
  // DB-Count prüfen (an Schema anpassen):
  // const [{ c }] = await db.select({ c: count() }).from(reservations).where(eq(reservations.tableId, slot));
  // assert.equal(c, 1);
});

test('idempotency: gleicher Key zweimal -> 1 Datensatz', async () => {
  const key = `idem-${randomUUID()}`;
  const body = JSON.stringify({
    eventId: 'loadtest-event',
    day: '2026-12-03',
    guestCount: 2,
    tableId: 'idem-slot',
    selectedTime: '19:00',
    idempotencyKey: key,
  });
  const r1 = await fetch('http://127.0.0.1:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body,
  });
  const r2 = await fetch('http://127.0.0.1:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body,
  });
  // Beide sollten denselben Datensatz referenzieren (gleiche ID in Response)
  await r1.json().catch(() => ({}));
  await r2.json().catch(() => ({}));
  // An Response-Schema anpassen:
  // assert.equal(j1.reservationId, j2.reservationId);
  // DB-Count für diesen Key == 1
});
