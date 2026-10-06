import sharp from 'sharp';

export interface OptimizedImage {
  buffer: Buffer;
  format: 'webp' | 'jpg';
  size: number; // in bytes
}

export async function optimizeImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'webp' | 'jpg';
  } = {}
): Promise<OptimizedImage> {
  const {
    maxWidth = 1920,      // Mehr braucht kein Bildschirm
    maxHeight = 1920,
    quality = 80,          // 80% ist visuell kaum Unterschied zu 100%
    format = 'webp',       // WebP ist 50-80% kleiner als JPG
  } = options;

  // File zu Buffer konvertieren
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Original-Größe loggen (für Debugging)
  const originalSize = buffer.length;

  // Mit sharp optimieren
  let pipeline = sharp(buffer);

  // Resize (nur wenn Bild größer ist als Target)
  pipeline = pipeline.resize(maxWidth, maxHeight, {
    fit: 'inside',          // Behält Aspect Ratio bei
    withoutEnlargement: true, // Vergrößert kleine Bilder NICHT
  });

  // Format konvertieren + Qualität setzen
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.jpeg({ quality });
  }

  const optimizedBuffer = await pipeline.toBuffer();
  const optimizedSize = optimizedBuffer.length;

  console.log(
    `📷 Image optimized: ${(originalSize / 1024).toFixed(1)}KB → ` +
    `${(optimizedSize / 1024).toFixed(1)}KB ` +
    `(${(100 - (optimizedSize / originalSize) * 100).toFixed(1)}% saved)`
  );

  return {
    buffer: optimizedBuffer,
    format,
    size: optimizedSize,
  };
}
