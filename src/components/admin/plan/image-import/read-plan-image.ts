import cvModule from '@techstark/opencv-js';
import type { OpenCv } from './detect-plan';

let cvPromise: Promise<OpenCv> | null = null;

function loadOpenCv() {
  if (!cvPromise) {
    cvPromise = (async () => {
      const loaded = cvModule as unknown as (OpenCv & { onRuntimeInitialized?: () => void }) | Promise<OpenCv>;
      if (loaded instanceof Promise) return await loaded;
      if (loaded.Mat) return loaded;
      return await new Promise<OpenCv>(resolve => { loaded.onRuntimeInitialized = () => resolve(loaded); });
    })().catch(error => { cvPromise = null; throw error; });
  }
  return cvPromise;
}

export async function detectPlanFile(file: File, onProgress: (message: string) => void) {
  onProgress('Bild wird lokal geladen …');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 40 || bitmap.height < 40) throw new Error('Das Bild ist zu klein. Mindestens 40 × 40 Pixel werden benötigt.');
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Das Bild ist zu groß. Bitte maximal 40 Megapixel verwenden.');
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Die Bildverarbeitung wird von diesem Browser nicht unterstützt.');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    onProgress('Bilderkennung wird einmalig geladen …');
    const [cv, { detectPlanImage }] = await Promise.all([loadOpenCv(), import('./detect-plan')]);
    onProgress('Garnituren und Flächen werden erkannt …');
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const source = cv.imread(canvas);
    try {
      return detectPlanImage(cv, source);
    } finally {
      source.delete();
    }
  } finally {
    bitmap.close();
  }
}
