import { db } from '../src/db';
import { events, galleries } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

async function uploadToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables missing');
  }

  // Optimize with Sharp (simulating optimizeImage from src/lib/imageOptimizer.ts)
  let pipeline = sharp(buffer);
  pipeline = pipeline.resize(1920, 1920, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  pipeline = pipeline.webp({ quality: 80 });
  const optimizedBuffer = await pipeline.toBuffer();

  const formData = new FormData();
  
  // Create Blob to append to FormData
  const blob = new Blob([optimizedBuffer], { type: 'image/webp' });
  formData.append('file', blob, originalName.replace(/\.[^.]+$/, '') + '.webp');
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'maurer-events');
  formData.append('public_id', randomUUID());

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Upload failed');
  }

  return data.secure_url;
}

async function processImage(url: string, name: string): Promise<string> {
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  console.log(`Uploading to Cloudinary...`);
  return await uploadToCloudinary(buffer, name);
}

async function main() {
  console.log('Starte Cloudinary Upload für Dummy-Bilder...');

  // 1. Events aktualisieren
  const allEvents = await db.select().from(events).where(eq(events.type, 'gallery'));
  
  for (const ev of allEvents) {
    if (ev.imageUrl && ev.imageUrl.includes('unsplash.com')) {
      console.log(`Verarbeite Event: ${ev.title}`);
      try {
        const newUrl = await processImage(ev.imageUrl, 'event_cover.jpg');
        await db.update(events).set({ imageUrl: newUrl }).where(eq(events.id, ev.id));
        console.log(`-> Event Cover aktualisiert: ${newUrl}`);
      } catch (err) {
        console.error(`Fehler bei Event ${ev.title}:`, err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    }
  }

  // 2. Galerie-Bilder aktualisieren
  const allGalleries = await db.select().from(galleries);
  for (const gal of allGalleries) {
    if (gal.imageUrl.includes('unsplash.com')) {
      console.log(`Verarbeite Galeriebild ID: ${gal.id}`);
      try {
        const newUrl = await processImage(gal.imageUrl, 'gallery_img.jpg');
        await db.update(galleries).set({ imageUrl: newUrl }).where(eq(galleries.id, gal.id));
        console.log(`-> Galeriebild aktualisiert: ${newUrl}`);
      } catch (err) {
        console.error(`Fehler bei Galeriebild ${gal.id}:`, err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    }
  }

  console.log('Fertig!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
