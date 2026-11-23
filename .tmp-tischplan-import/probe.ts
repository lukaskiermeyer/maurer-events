import cvReady from '@techstark/opencv-js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const cv = await cvReady;
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(path.resolve('.tmp-tischplan-import/referenz.jpeg')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = { width: info.width, height: info.height };
  const src = cv.matFromArray(info.height, info.width, cv.CV_8UC4, Array.from(data));
  const rgb = new cv.Mat();
  const hsv = new cv.Mat();
  const gray = new cv.Mat();
  const dark = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
  cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
  cv.threshold(gray, dark, 85, 255, cv.THRESH_BINARY_INV);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(dark, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const bounds = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const rect = cv.boundingRect(contour);
    if (rect.width > src.cols * .4 && rect.height > src.rows * .4) bounds.push({ ...rect, area: cv.contourArea(contour) });
    contour.delete();
  }
  console.log('BOUNDARY', bounds);
  const configs = [
    ['tables', 13, 32, 80, 200],
    ['green', 35, 95, 30, 70],
    ['brown', 7, 28, 70, 35],
    ['black', 0, 179, 0, 0],
  ] as const;
  for (const [name, h0, h1, s0, v0] of configs) {
    const lower = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), name === 'black' ? [0, 0, 0, 0] : [h0, s0, v0, 0]);
    const upper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), name === 'black' ? [179, 255, 70, 0] : [h1, 255, 255, 0]);
    const mask = new cv.Mat();
    cv.inRange(hsv, lower, upper, mask);
    if (name === 'tables' || name === 'green') cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    const labels = new cv.Mat();
    const stats = new cv.Mat();
    const centers = new cv.Mat();
    const count = cv.connectedComponentsWithStats(mask, labels, stats, centers, 8, cv.CV_32S);
    const found = [];
    for (let i = 1; i < count; i++) {
      const x = stats.intPtr(i, cv.CC_STAT_LEFT)[0];
      const y = stats.intPtr(i, cv.CC_STAT_TOP)[0];
      const w = stats.intPtr(i, cv.CC_STAT_WIDTH)[0];
      const h = stats.intPtr(i, cv.CC_STAT_HEIGHT)[0];
      const area = stats.intPtr(i, cv.CC_STAT_AREA)[0];
      const fill = area / (w * h);
      const long = Math.max(w, h);
      const short = Math.min(w, h);
      if (name === 'tables' && long >= 6 && short >= 2 && long / short >= 1.8 && long / short <= 25 && fill >= .45 && w < src.cols * .4 && h < src.rows * .4) found.push({ x, y, w, h, area, fill: +fill.toFixed(2) });
      if (name === 'green' && area > 400 && fill > .4) found.push({ x, y, w, h, area, fill: +fill.toFixed(2) });
      if ((name === 'brown' || name === 'black') && area > 400 && fill > .6) found.push({ x, y, w, h, area, fill: +fill.toFixed(2) });
    }
    console.log(name.toUpperCase(), found.length, JSON.stringify(found));
    fs.writeFileSync(`.tmp-tischplan-import/${name}.json`, JSON.stringify(found, null, 2));
    lower.delete(); upper.delete(); mask.delete(); labels.delete(); stats.delete(); centers.delete();
  }
  src.delete(); rgb.delete(); hsv.delete(); gray.delete(); dark.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
}
void main();
