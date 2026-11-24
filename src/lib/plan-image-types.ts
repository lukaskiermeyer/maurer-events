export type ImageRect = { x: number; y: number; w: number; h: number };
export type DetectedPlanKind = 'table' | 'area' | 'stage' | 'technique';

export interface DetectedPlanObject {
  id: string;
  kind: DetectedPlanKind;
  rect: ImageRect;
  vertical: boolean;
  confidence: 'high' | 'review';
  color?: string;
  label: string;
}

export interface PlanImageDetection {
  imageWidth: number;
  imageHeight: number;
  frame: ImageRect;
  frameConfidence: 'high' | 'review';
  objects: DetectedPlanObject[];
  medianTableLongPx: number | null;
  splitTableCount: number;
  warnings: string[];
}

export type ImageScaleMode = 'table' | 'dimensions';

export interface ImageImportOptions {
  scaleMode: ImageScaleMode;
  tableLengthCm: number;
  widthCm: number;
  heightCm: number;
  capacity: number;
  excludedIds: Set<string>;
  labels: Record<string, string>;
}

export function defaultImageImportOptions(detection: PlanImageDetection): ImageImportOptions {
  const scale = detection.medianTableLongPx ? 220 / detection.medianTableLongPx : 1;
  return {
    scaleMode: detection.medianTableLongPx ? 'table' : 'dimensions',
    tableLengthCm: 220,
    widthCm: Math.max(100, Math.round(detection.frame.w * scale / 10) * 10),
    heightCm: Math.max(100, Math.round(detection.frame.h * scale / 10) * 10),
    capacity: 8,
    excludedIds: new Set<string>(),
    labels: {},
  };
}
