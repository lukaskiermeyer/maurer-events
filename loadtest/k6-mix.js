// k6-Lasttest: realistischer Mix für maurer-events
// Ausführung: k6 run --out json=results.json loadtest/k6-mix.js
// Lastgenerator MUSS auf separatem Host laufen (nicht auf Zielserver).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://maurer-events.madebylui.net';
const CRON_SECRET = __ENV.CRON_SECRET || '';

const errorRate = new Rate('errors');
const p95Trend = new Trend('req_duration');

export const options = {
  scenarios: {
    public_browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 150 },
        { duration: '3m', target: 150 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'publicFlow',
    },
    employee_portal: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '2m', target: 25 },
        { duration: '3m', target: 25 },
        { duration: '2m', target: 75 },
        { duration: '3m', target: 75 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'employeeFlow',
    },
    contention_booking: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 60,
      maxVUs: 100,
      exec: 'contentionFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
    'http_req_duration{scenario:public_browse}': ['p(95)<500'],
    'http_req_duration{scenario:employee_portal}': ['p(95)<500'],
  },
};

const params = { headers: { 'Accept': 'text/html,application/json' } };

export function publicFlow() {
  // Info-Seiten
  let r = http.get(`${BASE}/de`, params);
  check(r, { 'home 200': (x) => x.status === 200 });
  errorRate.add(r.status !== 200);
  p95Trend.add(r.timings.duration);

  sleep(1 + Math.random() * 2);

  // Verfügbarkeitsabfrage (Beispiel-Endpoint anpassen)
  r = http.get(`${BASE}/api/health`, params);
  check(r, { 'health 200': (x) => x.status === 200 });
  errorRate.add(r.status !== 200);

  sleep(0.5);

  // Reservierungs-POST (Beispiel-Payload; echte Route anpassen)
  const payload = JSON.stringify({
    eventId: 'loadtest-event',
    day: '2026-12-01',
    guestCount: 4,
    tableId: 't1',
    selectedTime: '19:00',
  });
  r = http.post(`${BASE}/api/checkout`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  // Erwartet 200/303/409 je nach Kapazität; 5xx zählt als Fehler
  check(r, { 'checkout no 5xx': (x) => x.status < 500 });
  errorRate.add(r.status >= 500);

  sleep(2 + Math.random() * 3);
}

export function employeeFlow() {
  // Login (OTP anfordern) - Beispiel
  let r = http.post(`${BASE}/api/auth/otp/request`, JSON.stringify({ email: 'loadtest@example.com' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'otp request ok': (x) => x.status < 500 });
  errorRate.add(r.status >= 500);

  sleep(1);

  // Schichtliste lesen
  r = http.get(`${BASE}/de/admin`, params);
  check(r, { 'admin 2xx/3xx': (x) => x.status < 400 || x.status === 401 || x.status === 403 });
  // 401/403 sind erwartbar ohne echte Session; zählen nicht als Fehler
  errorRate.add(r.status >= 500);

  sleep(1);

  // Upload-Signatur anfordern (Beispiel-Endpoint anpassen)
  r = http.post(`${BASE}/api/team/upload`, null, params);
  check(r, { 'upload sig no 5xx': (x) => x.status < 500 });
  errorRate.add(r.status >= 500);

  sleep(1 + Math.random() * 2);
}

// Contention: 50 parallele Buchungen auf denselben Slot
let slotCounter = 0;
export function contentionFlow() {
  const idem = `idem-${__VU}-${__ITER}`;
  const payload = JSON.stringify({
    eventId: 'loadtest-event',
    day: '2026-12-02',
    guestCount: 2,
    tableId: 'contended-slot',
    selectedTime: '20:00',
    idempotencyKey: idem,
  });
  const r = http.post(`${BASE}/api/checkout`, payload, {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem },
  });
  check(r, { 'contention no 5xx': (x) => x.status < 500 });
  errorRate.add(r.status >= 500);
}
