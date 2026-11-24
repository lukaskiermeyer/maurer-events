import assert from 'node:assert/strict';
import { test } from 'node:test';
import cvReady from '@techstark/opencv-js';
import { detectPlanImage } from '../src/components/admin/plan/image-import/detect-plan';
import { defaultImageImportOptions, type PlanImageDetection } from '../src/lib/plan-image-types';
import { imageDetectionToLayout } from '../src/lib/plan-image-layout';
import { isLayout, planTables } from '../src/lib/plan-types';

const syntheticDetection = (): PlanImageDetection => ({
  imageWidth: 200, imageHeight: 200, frame: { x: 0, y: 0, w: 100, h: 200 }, frameConfidence: 'high', medianTableLongPx: 40, splitTableCount: 0, warnings: [],
  objects: [
    { id: 'area-1', kind: 'area', rect: { x: 0, y: 0, w: 100, h: 100 }, vertical: false, confidence: 'high', color: '#2ECC71', label: 'Bereich 1' },
    { id: 'stage-1', kind: 'stage', rect: { x: 50, y: 120, w: 40, h: 60 }, vertical: true, confidence: 'review', label: 'Bühne 1' },
    { id: 'table-1', kind: 'table', rect: { x: 10, y: 20, w: 40, h: 10 }, vertical: false, confidence: 'high', label: 'Garnitur 1' },
    { id: 'table-2', kind: 'table', rect: { x: 10, y: 50, w: 40, h: 10 }, vertical: false, confidence: 'high', label: 'Garnitur 2' },
  ],
});

test('Garnitur-Referenz erzeugt konsistente Zentimeter, Nummern und Bereiche', () => {
  const detection = syntheticDetection();
  const options = defaultImageImportOptions(detection);
  options.labels['area-1'] = 'Biergarten';
  const layout = imageDetectionToLayout(detection, options);
  assert.ok(isLayout(layout));
  assert.equal(layout.widthCm, 550);
  assert.equal(layout.heightCm, 1100);
  assert.equal(layout.nextNumber, 3);
  const tables = planTables(layout);
  assert.deepEqual(tables.map(table => table.number), [1, 2]);
  assert.deepEqual(tables.map(table => table.capacity), [8, 8]);
  assert.equal(tables[0].w, 220);
  assert.equal(tables[0].h, 55);
  assert.equal(tables[0].benchDepth, 0);
  assert.equal(tables[0].areaId, 'image-area-1');
  assert.equal(layout.elements.find(element => element.id === 'image-area-1')?.kind, 'area');
  assert.equal(new Set(layout.elements.map(element => element.id)).size, layout.elements.length);
  assert.ok(tables.every(table => table.x >= 0 && table.y >= 0 && table.x + table.w <= layout.widthCm && table.y + table.h <= layout.heightCm));
});

test('Gesamtmaße, Ausschlüsse und fehlende Tabellenreferenz werden korrekt behandelt', () => {
  const detection = syntheticDetection();
  const options = { ...defaultImageImportOptions(detection), scaleMode: 'dimensions' as const, widthCm: 1000, heightCm: 800, excludedIds: new Set(['table-2', 'stage-1']) };
  const layout = imageDetectionToLayout(detection, options);
  assert.equal(layout.widthCm, 1000);
  assert.equal(layout.heightCm, 800);
  assert.equal(planTables(layout).length, 1);
  assert.equal(planTables(layout)[0].w, 400);
  assert.equal(planTables(layout)[0].h, 40);
  assert.equal(layout.nextNumber, 2);
  assert.ok(!layout.elements.some(element => element.id === 'image-stage-1'));
  assert.throws(() => imageDetectionToLayout({ ...detection, medianTableLongPx: null }, { ...options, scaleMode: 'table', excludedIds: new Set() }), /Garnitur-Referenz/);
  assert.throws(() => imageDetectionToLayout(detection, { ...options, widthCm: 0 }), /Planbreite/);
});

test('OpenCV erkennt synthetische Garnituren, Bereich, Bühne und Technik ohne externe Datei', async () => {
  const cv = await cvReady;
  const image = new cv.Mat(400, 500, cv.CV_8UC4, [255, 255, 255, 255]);
  try {
    const rectangle = (x1: number, y1: number, x2: number, y2: number, color: number[], thickness = -1) => cv.rectangle(image, new cv.Point(x1, y1), new cv.Point(x2, y2), color, thickness);
    rectangle(20, 20, 480, 380, [0, 0, 0, 255], 3);
    rectangle(40, 40, 180, 120, [46, 204, 113, 255]);
    rectangle(50, 50, 110, 62, [248, 125, 45, 255]);
    rectangle(50, 75, 110, 87, [248, 125, 45, 255]);
    rectangle(150, 50, 162, 110, [248, 125, 45, 255]);
    rectangle(300, 70, 400, 150, [139, 78, 33, 255]);
    rectangle(50, 300, 100, 350, [0, 0, 0, 255]);
    const result = detectPlanImage(cv, image);
    const count = (kind: string) => result.objects.filter(object => object.kind === kind).length;
    assert.equal(count('table'), 3);
    assert.equal(count('area'), 1);
    assert.equal(count('stage'), 1);
    assert.equal(count('technique'), 1, JSON.stringify(result.objects.filter(object => object.kind === 'technique')));
    assert.equal(result.medianTableLongPx, 61);
    assert.equal(result.frameConfidence, 'high');
    const layout = imageDetectionToLayout(result, defaultImageImportOptions(result));
    assert.ok(isLayout(layout));
    assert.equal(planTables(layout).length, 3);
  } finally { image.delete(); }
});


test('Leeres Bild erzeugt keine falschen Erfolgsobjekte', async () => {
  const cv = await cvReady;
  const image = new cv.Mat(200, 300, cv.CV_8UC4, [255, 255, 255, 255]);
  try {
    const result = detectPlanImage(cv, image);
    assert.equal(result.objects.length, 0);
    assert.ok(result.warnings.some(warning => warning.includes('Keine orangefarbenen Garnituren')));
  } finally { image.delete(); }
});
