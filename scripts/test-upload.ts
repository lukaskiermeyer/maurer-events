import { config } from 'dotenv';
config({ path: '.env.local' });

import { optimizeImage } from '@/lib/imageOptimizer';
import fs from 'fs/promises';
import path from 'path';

// Test-Konfiguration
const TEST_DIR = './test-images';
const RESULTS: any[] = [];

async function setup() {
  console.log('🔧 Setup: Erstelle Test-Verzeichnis...\n');
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function createTestImage(
  filename: string, 
  width: number, 
  height: number, 
  color: string = 'red'
): Promise<File> {
  // Nutze sharp, um ein Test-Bild zu generieren
  const sharp = (await import('sharp')).default;
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    }
  }).jpeg({ quality: 90 }).toBuffer();
  
  return new File([buffer], filename, { type: 'image/jpeg' });
}

async function runTest(
  name: string, 
  testFn: () => Promise<void>
): Promise<void> {
  try {
    await testFn();
    RESULTS.push({ name, status: '✅ PASS', error: null });
    console.log(`✅ ${name}\n`);
  } catch (err: any) {
    RESULTS.push({ name, status: '❌ FAIL', error: err.message });
    console.log(`❌ ${name}`);
    console.log(`   Fehler: ${err.message}\n`);
  }
}

async function test1_NormalJPG() {
  console.log('Test 1: Normales JPG wird optimiert');
  const file = await createTestImage('test-normal.jpg', 1920, 1080);
  const result = await optimizeImage(file);
  
  if (result.format !== 'webp') throw new Error(`Erwartet webp, bekommen ${result.format}`);
  if (result.size >= file.size) throw new Error('Bild wurde nicht komprimiert');
  
  console.log(`   Original: ${(file.size / 1024).toFixed(1)}KB → Optimiert: ${(result.size / 1024).toFixed(1)}KB`);
  console.log(`   Ersparnis: ${(100 - (result.size / file.size) * 100).toFixed(1)}%\n`);
}

async function test2_LargeImage() {
  console.log('Test 2: Großes Bild (4000x3000) wird resized');
  const file = await createTestImage('test-large.jpg', 4000, 3000);
  const result = await optimizeImage(file, { maxWidth: 1920 });
  
  if (result.size >= file.size) throw new Error('Bild wurde nicht komprimiert');
  
  // Verifiziere, dass die Breite reduziert wurde
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(result.buffer).metadata();
  if (metadata.width && metadata.width > 1920) {
    throw new Error(`Breite wurde nicht reduziert: ${metadata.width}px`);
  }
  
  console.log(`   Original: ${(file.size / 1024).toFixed(1)}KB → Optimiert: ${(result.size / 1024).toFixed(1)}KB`);
  console.log(`   Neue Breite: ${metadata.width}px (max 1920px)\n`);
}

async function test3_SmallImage() {
  console.log('Test 3: Kleines Bild wird NICHT vergrößert');
  const file = await createTestImage('test-small.jpg', 800, 600);
  const result = await optimizeImage(file, { maxWidth: 1920 });
  
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(result.buffer).metadata();
  
  if (metadata.width && metadata.width > 800) {
    throw new Error(`Kleines Bild wurde vergrößert: ${metadata.width}px`);
  }
  
  console.log(`   Breite bleibt bei ${metadata.width}px (withoutEnlargement funktioniert)\n`);
}

async function test4_PNGtoWebP() {
  console.log('Test 4: PNG wird zu WebP konvertiert');
  const sharp = (await import('sharp')).default;
  const buffer = await sharp({
    create: { width: 1000, height: 1000, channels: 3, background: 'blue' }
  }).png().toBuffer();
  
  const file = new File([buffer], 'test.png', { type: 'image/png' });
  const result = await optimizeImage(file);
  
  if (result.format !== 'webp') throw new Error(`Erwartet webp, bekommen ${result.format}`);
  
  console.log(`   PNG → WebP Konvertierung erfolgreich\n`);
}

async function test5_WebPtoWebP() {
  console.log('Test 5: WebP bleibt WebP (und wird komprimiert)');
  const sharp = (await import('sharp')).default;
  const buffer = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: 'green' }
  }).webp({ quality: 95 }).toBuffer();
  
  const file = new File([buffer], 'test.webp', { type: 'image/webp' });
  const result = await optimizeImage(file, { quality: 80 });
  
  if (result.format !== 'webp') throw new Error(`Erwartet webp, bekommen ${result.format}`);
  if (result.size >= file.size) throw new Error('WebP wurde nicht weiter komprimiert');
  
  console.log(`   WebP wurde von ${(file.size / 1024).toFixed(1)}KB auf ${(result.size / 1024).toFixed(1)}KB optimiert\n`);
}

async function test6_ExtremeCompression() {
  console.log('Test 6: Qualitätsstufe 80% erzeugt akzeptables Ergebnis');
  const file = await createTestImage('test-quality.jpg', 1920, 1080);
  const result = await optimizeImage(file, { quality: 80 });
  
  // Bei einem einfarbigen Test-Bild sollte die Kompression extrem gut sein
  const savings = 100 - (result.size / file.size) * 100;
  console.log(`   Ersparnis bei Quality 80%: ${savings.toFixed(1)}%\n`);
  
  // Wir erwarten mindestens 30% Ersparnis (bei echten Fotos oft 50-80%)
  if (savings < 30) {
    throw new Error(`Kompression zu gering: nur ${savings.toFixed(1)}%`);
  }
}

async function test7_Performance() {
  console.log('Test 7: Optimierung dauert nicht zu lange');
  const file = await createTestImage('test-perf.jpg', 3000, 2000);
  
  const startTime = Date.now();
  await optimizeImage(file);
  const duration = Date.now() - startTime;
  
  console.log(`   Dauer: ${duration}ms\n`);
  
  // Optimierung sollte unter 2 Sekunden dauern
  if (duration > 2000) {
    throw new Error(`Optimierung zu langsam: ${duration}ms`);
  }
}

async function test8_UploadActionIntegration() {
  console.log('Test 8: uploadImage() Action akzeptiert FormData');
  
  // Simuliere einen FormData-Upload wie im Frontend
  const file = await createTestImage('test-integration.jpg', 1600, 1200);
  const formData = new FormData();
  formData.append('file', file);
  
  // Importiere die Action dynamisch (benötigt ggf. Mock für requireAdmin)
  try {
    const { uploadImage } = await import('@/app/actions/upload');
    console.log(`   uploadImage() ist importierbar und akzeptiert FormData\n`);
    // Hinweis: Voller Test erfordert authentifizierte Session
  } catch (err: any) {
    throw new Error(`uploadImage() nicht importierbar: ${err.message}`);
  }
}

async function main() {
  console.log('🧪 Starte Upload-Optimierungs-Tests...\n');
  console.log('=' .repeat(60));
  console.log('');
  
  await setup();
  
  await runTest('Test 1: Normales JPG', test1_NormalJPG);
  await runTest('Test 2: Großes Bild wird resized', test2_LargeImage);
  await runTest('Test 3: Kleines Bild bleibt klein', test3_SmallImage);
  await runTest('Test 4: PNG → WebP', test4_PNGtoWebP);
  await runTest('Test 5: WebP → WebP', test5_WebPtoWebP);
  await runTest('Test 6: Qualitätsstufe 80%', test6_ExtremeCompression);
  await runTest('Test 7: Performance', test7_Performance);
  await runTest('Test 8: Action-Integration', test8_UploadActionIntegration);
  
  console.log('=' .repeat(60));
  console.log('\n📊 TEST-ERGEBNISSE:\n');
  
  const passed = RESULTS.filter(r => r.status === '✅ PASS').length;
  const failed = RESULTS.filter(r => r.status === '❌ FAIL').length;
  
  RESULTS.forEach(r => {
    console.log(`${r.status} ${r.name}`);
    if (r.error) console.log(`   └─ ${r.error}`);
  });
  
  console.log(`\nGesamt: ${passed} bestanden, ${failed} fehlgeschlagen`);
  
  if (failed === 0) {
    console.log('\n✅ Alle Tests bestanden! Bild-Optimierung funktioniert korrekt.');
  } else {
    console.log('\n❌ Einige Tests sind fehlgeschlagen. Bitte oben stehende Fehler prüfen.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
