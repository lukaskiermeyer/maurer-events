import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PlanStaticSvg } from '../src/components/admin/plan/PlanCanvas';
import {
  computeDimensions,
  isLayout,
  measurementDistance,
  measurementEndpoint,
  planBounds,
  type PlanLayout,
} from '../src/lib/plan-types';

const baseLayout = (): PlanLayout => ({
  version: 1,
  widthCm: 1000,
  heightCm: 800,
  tablePrefix: 'T',
  nextNumber: 1,
  printDims: [],
  elements: [{ kind: 'boundary', id: 'zelt', x: 0, y: 0, w: 1000, h: 800, label: 'Zelt' }],
  measurements: [
    { id: 'm-visible', a: { x: 100, y: 200 }, b: { x: 350, y: 200 }, label: 'Hauptgang', print: true },
    { id: 'm-hidden', a: { x: 100, y: 300 }, b: { x: 100, y: 450 }, label: 'Nur intern', print: false },
  ],
});

test('Schnellmessung rastet auf die dominante Achse, freie Messung bleibt unverändert', () => {
  const a = { x: 100, y: 200 };
  const b = { x: 430, y: 245 };
  assert.deepEqual(measurementEndpoint(a, b, 'axis'), { x: 430, y: 200 });
  assert.deepEqual(measurementEndpoint(a, { x: 130, y: 445 }, 'axis'), { x: 100, y: 445 });
  assert.deepEqual(measurementEndpoint(a, b, 'free'), b);
  assert.equal(measurementDistance({ a, b: measurementEndpoint(a, b, 'axis') }), 330);
});

test('Eigene Maße bleiben beim Serialisieren erhalten und werden validiert', () => {
  const restored = JSON.parse(JSON.stringify(baseLayout())) as unknown;
  assert.ok(isLayout(restored));
  assert.equal(restored.measurements?.[0].label, 'Hauptgang');
  assert.equal(restored.measurements?.[1].print, false);

  const invalid = baseLayout();
  invalid.measurements![0].label = 'x'.repeat(81);
  assert.equal(isLayout(invalid), false);
});

test('Automatische Maße lassen sich vollständig abwählen', () => {
  const layout = baseLayout();
  assert.deepEqual(computeDimensions(layout), []);
  assert.equal(computeDimensions({ ...layout, printDims: ['zelt'] }).length, 2);
  assert.ok(computeDimensions({ ...layout, printDims: ['zelt'] }).every(d => d.cat === 'zelt'));
});

test('Manuelle Maße außerhalb des Zelts erweitern die sichtbaren Plangrenzen', () => {
  const layout = baseLayout();
  layout.measurements![0].b.x = 1400;
  const bounds = planBounds(layout);
  assert.equal(bounds.maxX, 1400);
});

test('Aufbauplan gibt nur ausdrücklich freigeschaltete eigene Maße aus', () => {
  const layout = baseLayout();
  const html = renderToString(createElement(PlanStaticSvg, { layout, showDims: true, neutral: true }));
  assert.ok(html.includes('Hauptgang: 250 cm'));
  assert.ok(!html.includes('Nur intern'));
  assert.ok(!html.includes('Δx'));

  const withoutDims = renderToString(createElement(PlanStaticSvg, { layout, showDims: false }));
  assert.ok(!withoutDims.includes('Hauptgang'));
});
