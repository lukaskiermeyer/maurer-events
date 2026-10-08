"use client";

import { uploadImage as uploadPreparedImage } from '@/app/actions/upload';

// Resize before the Server Action: phone photos must fit through both Vercel
// and Next.js, even though the original file is allowed to be up to 10 MB.
export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new Error('Bitte ein Bild auswählen.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Nur JPG, PNG und WebP erlaubt. HEIC bitte zuerst als JPG exportieren.');
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('Datei zu groß (max. 10 MB).');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Das Bild konnte nicht vorbereitet werden.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Bitte ein kleineres Bild verwenden (Upload max. 3 MB).');
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      const prepared = new FormData();
      prepared.append('file', new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type }));
      return await uploadPreparedImage(prepared);
    } finally {
      bitmap.close();
    }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Bildupload fehlgeschlagen.' };
  }
}
