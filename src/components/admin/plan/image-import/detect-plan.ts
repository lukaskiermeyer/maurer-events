import { AREA_COLORS } from '@/lib/plan-types';
import type { DetectedPlanObject, ImageRect, PlanImageDetection } from '@/lib/plan-image-types';

export type OpenCv = typeof import('@techstark/opencv-js');
type CvMat = ReturnType<OpenCv['matFromImageData']>;
type RawRect = ImageRect & { area: number; fill: number };

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const overlapRatio = (a: ImageRect, b: ImageRect) => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return w * h / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
};
const containsCenter = (outer: ImageRect, inner: ImageRect) => {
  const x = inner.x + inner.w / 2;
  const y = inner.y + inner.h / 2;
  return x >= outer.x && x <= outer.x + outer.w && y >= outer.y && y <= outer.y + outer.h;
};

function components(cv: OpenCv, mask: CvMat): RawRect[] {
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centers = new cv.Mat();
  try {
    const count = cv.connectedComponentsWithStats(mask, labels, stats, centers, 8, cv.CV_32S);
    const result: RawRect[] = [];
    for (let i = 1; i < count; i++) {
      const x = stats.intPtr(i, cv.CC_STAT_LEFT)[0];
      const y = stats.intPtr(i, cv.CC_STAT_TOP)[0];
      const w = stats.intPtr(i, cv.CC_STAT_WIDTH)[0];
      const h = stats.intPtr(i, cv.CC_STAT_HEIGHT)[0];
      const area = stats.intPtr(i, cv.CC_STAT_AREA)[0];
      if (w > 0 && h > 0) result.push({ x, y, w, h, area, fill: area / (w * h) });
    }
    return result;
  } finally {
    labels.delete(); stats.delete(); centers.delete();
  }
}

function hsvMask(cv: OpenCv, hsv: CvMat, lower: number[], upper: number[], close = false) {
  const lo = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...lower, 0]);
  const hi = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...upper, 0]);
  const mask = new cv.Mat();
  const kernel = close ? cv.Mat.ones(3, 3, cv.CV_8U) : null;
  try {
    cv.inRange(hsv, lo, hi, mask);
    if (kernel) cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    return mask;
  } finally {
    lo.delete(); hi.delete(); kernel?.delete();
  }
}

function colorForArea(cv: OpenCv, src: CvMat, mask: CvMat, rect: ImageRect) {
  const region = new cv.Rect(rect.x, rect.y, rect.w, rect.h);
  const color = src.roi(region);
  const selection = mask.roi(region);
  try {
    const mean = cv.mean(color, selection);
    let nearest = AREA_COLORS[1];
    let distance = Infinity;
    for (const candidate of AREA_COLORS.slice(1)) {
      const rgb = candidate.match(/[a-f\d]{2}/gi)?.map(v => parseInt(v, 16)) ?? [];
      const d = rgb.reduce((sum, value, index) => sum + (value - mean[index]) ** 2, 0);
      if (d < distance) { distance = d; nearest = candidate; }
    }
    return nearest;
  } finally {
    color.delete(); selection.delete();
  }
}

function detectFrame(cv: OpenCv, dark: CvMat): ImageRect | null {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(dark, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best: ImageRect | null = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const r = cv.boundingRect(contour);
      contour.delete();
      if (r.width < dark.cols * .35 || r.height < dark.rows * .35) continue;
      const area = r.width * r.height;
      if (area > bestArea) { best = { x: r.x, y: r.y, w: r.width, h: r.height }; bestArea = area; }
    }
    return best;
  } finally {
    contours.delete(); hierarchy.delete();
  }
}

function normalizeTables(raw: RawRect[]) {
  const longUnit = median(raw.map(r => Math.max(r.w, r.h)));
  const shortUnit = median(raw.map(r => Math.min(r.w, r.h)));
  if (!longUnit || !shortUnit) return { tables: [] as DetectedPlanObject[], splitCount: 0 };
  const tables: DetectedPlanObject[] = [];
  let splitCount = 0;
  for (const r of raw) {
    const vertical = r.h > r.w;
    const long = Math.max(r.w, r.h);
    const short = Math.min(r.w, r.h);
    const longParts = long / longUnit >= 1.55 ? clamp(Math.round(long / longUnit), 2, 6) : 1;
    const shortParts = short / shortUnit >= 1.65 ? clamp(Math.round(short / shortUnit), 2, 3) : 1;
    const alongParts = vertical ? longParts : shortParts;
    const acrossParts = vertical ? shortParts : longParts;
    const cellW = r.w / acrossParts;
    const cellH = r.h / alongParts;
    for (let row = 0; row < alongParts; row++) {
      for (let col = 0; col < acrossParts; col++) {
        const split = longParts > 1 || shortParts > 1;
        const review = split || r.fill < .62 || short < shortUnit * .62;
        tables.push({
          id: `table-${tables.length + 1}`,
          kind: 'table',
          rect: { x: r.x + col * cellW, y: r.y + row * cellH, w: cellW, h: cellH },
          vertical,
          confidence: review ? 'review' : 'high',
          label: `Garnitur ${tables.length + 1}`,
        });
        if (split) splitCount++;
      }
    }
  }
  tables.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  return { tables: tables.map((table, i) => ({ ...table, id: `table-${i + 1}`, label: `Garnitur ${i + 1}` })), splitCount };
}

/** Farb- und Konturerkennung für achsenausgerichtete, digitale Planbilder. Keine OCR. */
export function detectPlanImage(cv: OpenCv, source: CvMat): PlanImageDetection {
  const rgb = new cv.Mat();
  const hsv = new cv.Mat();
  const gray = new cv.Mat();
  const dark = new cv.Mat();
  const masks: CvMat[] = [];
  try {
    cv.cvtColor(source, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    cv.threshold(gray, dark, 85, 255, cv.THRESH_BINARY_INV);
    const foundFrame = detectFrame(cv, dark);
    const orange = hsvMask(cv, hsv, [9, 80, 195], [32, 255, 255], true);
    masks.push(orange);
    const rawTables = components(cv, orange).filter(r => {
      const long = Math.max(r.w, r.h);
      const short = Math.min(r.w, r.h);
      return long >= Math.max(6, Math.min(source.cols, source.rows) * .004) && short >= 2 && long / short >= 1.8 && long / short <= 25 && r.fill >= .45 && r.w < source.cols * .4 && r.h < source.rows * .4;
    });
    const { tables, splitCount } = normalizeTables(rawTables);
    const typicalTableArea = median(tables.map(t => t.rect.w * t.rect.h));
    const frame = foundFrame ?? (() => {
      const all = [...tables.map(t => t.rect)];
      if (!all.length) return { x: 0, y: 0, w: source.cols, h: source.rows };
      const minX = Math.min(...all.map(r => r.x));
      const minY = Math.min(...all.map(r => r.y));
      const maxX = Math.max(...all.map(r => r.x + r.w));
      const maxY = Math.max(...all.map(r => r.y + r.h));
      const margin = Math.max(4, Math.round(Math.max(maxX - minX, maxY - minY) * .025));
      return { x: Math.max(0, minX - margin), y: Math.max(0, minY - margin), w: Math.min(source.cols, maxX + margin) - Math.max(0, minX - margin), h: Math.min(source.rows, maxY + margin) - Math.max(0, minY - margin) };
    })();
    const objects: DetectedPlanObject[] = [];
    const areaMasks = [
      hsvMask(cv, hsv, [35, 30, 70], [95, 255, 255], true),
      hsvMask(cv, hsv, [96, 65, 60], [120, 255, 255], true),
    ];
    masks.push(...areaMasks);
    let areaIndex = 0;
    for (const mask of areaMasks) {
      for (const r of components(cv, mask)) {
        const rect = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (r.area < frame.w * frame.h * .00035 || r.fill < .4 || !containsCenter(frame, rect)) continue;
        areaIndex++;
        objects.push({ id: `area-${areaIndex}`, kind: 'area', rect, vertical: r.h > r.w, confidence: r.fill > .65 ? 'high' : 'review', color: colorForArea(cv, rgb, mask, rect), label: `Bereich ${areaIndex}` });
      }
    }
    const brown = hsvMask(cv, hsv, [7, 70, 35], [28, 255, 165]);
    masks.push(brown);
    const stageKernel = cv.Mat.ones(9, 9, cv.CV_8U);
    try {
      cv.morphologyEx(brown, brown, cv.MORPH_OPEN, stageKernel);
      let stageIndex = 0;
      for (const r of components(cv, brown)) {
        const rect = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (r.area < Math.max(frame.w * frame.h * .002, typicalTableArea * 4) || r.fill < .55 || !containsCenter(frame, rect)) continue;
        if (tables.some(t => overlapRatio(t.rect, rect) > .15)) continue;
        stageIndex++;
        objects.push({ id: `stage-${stageIndex}`, kind: 'stage', rect, vertical: r.h > r.w, confidence: 'review', label: `Bühne ${stageIndex}` });
      }
    } finally {
      stageKernel.delete();
    }
    const neutralBlack = hsvMask(cv, hsv, [0, 0, 0], [179, 80, 70]);
    masks.push(neutralBlack);
    const black = new cv.Mat();
    const blackKernel = cv.Mat.ones(5, 5, cv.CV_8U);
    try {
      cv.erode(neutralBlack, black, blackKernel);
      let techniqueIndex = 0;
      for (const r of components(cv, black)) {
        const rect = { x: r.x + 2, y: r.y + 2, w: r.w + 4, h: r.h + 4 };
        if (Math.min(r.w, r.h) < 6 || Math.max(r.w, r.h) / Math.min(r.w, r.h) > 8 || r.area < frame.w * frame.h * .0005 || r.fill < .6 || !containsCenter(frame, rect)) continue;
        techniqueIndex++;
        objects.push({ id: `technique-${techniqueIndex}`, kind: 'technique', rect, vertical: r.h > r.w, confidence: 'review', color: '#1A1A1A', label: `Technik ${techniqueIndex}` });
      }
    } finally {
      black.delete(); blackKernel.delete();
    }
    objects.push(...tables);
    const warnings = [
      'Texte, Türen und Maßlinien werden nicht automatisch als verlässliche Angaben übernommen.',
      'Bitte Positionen, Tischgrößen und Bereichsnamen vor dem Speichern prüfen.',
    ];
    if (!foundFrame) warnings.unshift('Kein eindeutiger Außenrahmen gefunden. Der Zuschnitt wurde aus den Tischpositionen geschätzt.');
    if (splitCount) warnings.push(`${splitCount} Garnituren wurden aus verbundenen Farbflächen getrennt und sind zur Prüfung markiert.`);
    if (!tables.length) warnings.push('Keine orangefarbenen Garnituren erkannt. Bitte Gesamtgröße angeben und Tische anschließend ergänzen.');
    return { imageWidth: source.cols, imageHeight: source.rows, frame, frameConfidence: foundFrame ? 'high' : 'review', objects, medianTableLongPx: tables.length ? median(tables.map(t => Math.max(t.rect.w, t.rect.h))) : null, splitTableCount: splitCount, warnings };
  } finally {
    rgb.delete(); hsv.delete(); gray.delete(); dark.delete();
    for (const mask of masks) mask.delete();
  }
}
