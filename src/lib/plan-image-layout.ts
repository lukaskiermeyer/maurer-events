import { DEFAULT_NUMBERING, type PlanArea, type PlanElement, type PlanLayout, type PlanTable } from './plan-types';
import type { ImageImportOptions, ImageRect, PlanImageDetection } from './plan-image-types';

const rounded = (value: number) => Math.round(Number.isFinite(value) ? value : 0);
const positive = (value: number, name: string, min: number, max: number) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} muss zwischen ${min} und ${max} liegen.`);
  return value;
};

export function imageDetectionToLayout(detection: PlanImageDetection, options: ImageImportOptions): PlanLayout {
  const capacity = Math.round(positive(options.capacity, 'Kapazität', 1, 100));
  const tableScale = options.scaleMode === 'table'
    ? positive(options.tableLengthCm, 'Garniturlänge', 50, 500) / positive(detection.medianTableLongPx ?? 0, 'Garnitur-Referenz', 1, detection.imageWidth)
    : 0;
  const scaleX = options.scaleMode === 'table' ? tableScale : positive(options.widthCm, 'Planbreite', 100, 50_000) / detection.frame.w;
  const scaleY = options.scaleMode === 'table' ? tableScale : positive(options.heightCm, 'Planhöhe', 100, 50_000) / detection.frame.h;
  const widthCm = Math.max(100, rounded(detection.frame.w * scaleX));
  const heightCm = Math.max(100, rounded(detection.frame.h * scaleY));
  const mapRect = (source: ImageRect): ImageRect => {
    const left = Math.max(detection.frame.x, source.x);
    const top = Math.max(detection.frame.y, source.y);
    const right = Math.min(detection.frame.x + detection.frame.w, source.x + source.w);
    const bottom = Math.min(detection.frame.y + detection.frame.h, source.y + source.h);
    const x = rounded((left - detection.frame.x) * scaleX);
    const y = rounded((top - detection.frame.y) * scaleY);
    return { x, y, w: Math.max(1, rounded((right - detection.frame.x) * scaleX) - x), h: Math.max(1, rounded((bottom - detection.frame.y) * scaleY) - y) };
  };
  const included = detection.objects.filter(object => !options.excludedIds.has(object.id) && object.rect.w > 0 && object.rect.h > 0);
  const elements: PlanElement[] = [{ kind: 'boundary', id: 'image-boundary', x: 0, y: 0, w: widthCm, h: heightCm, label: 'Zelt / Planrahmen' }];
  const areas: PlanArea[] = [];
  for (const object of included) {
    if (object.kind !== 'area' && object.kind !== 'technique') continue;
    const label = (options.labels[object.id] ?? object.label).trim().slice(0, 80) || object.label;
    const area: PlanArea = { kind: 'area', id: `image-${object.id}`, ...mapRect(object.rect), label, color: object.kind === 'technique' ? '#1A1A1A' : object.color ?? '#D9D9D9' };
    areas.push(area);
    elements.push(area);
  }
  for (const object of included) {
    if (object.kind !== 'stage') continue;
    elements.push({ kind: 'stage', id: `image-${object.id}`, ...mapRect(object.rect), label: (options.labels[object.id] ?? object.label).trim().slice(0, 80) || object.label });
  }
  const tables = included.filter(object => object.kind === 'table').sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  tables.forEach((object, index) => {
    const rect = mapRect(object.rect);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const area = [...areas].reverse().find(candidate => cx >= candidate.x && cx <= candidate.x + candidate.w && cy >= candidate.y && cy <= candidate.y + candidate.h);
    const table: PlanTable = {
      kind: 'table', id: `image-${object.id}`, ...rect,
      number: index + 1, capacity, shape: 'rect', vertical: object.vertical,
      benchDepth: 0, benchGap: 0, areaId: area?.id ?? 'image-boundary',
    };
    elements.push(table);
  });
  return {
    version: 1, widthCm, heightCm, tablePrefix: 'T', nextNumber: tables.length + 1,
    numbering: { ...DEFAULT_NUMBERING }, printDims: ['zelt'], measurements: [], elements,
  };
}
