"use server";

import crypto from "crypto";
import { requireAdmin } from "@/lib/auth";
import { optimizeImage } from '@/lib/imageOptimizer';

export async function uploadImage(formData: FormData) {
  try {
    await requireAdmin();

    const file = formData.get("file") as File;
    if (!file) {
      throw new Error("No file uploaded");
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Nur JPG, PNG und WebP erlaubt');
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Datei zu groß (max 10MB)');
    }
    
    // NEU: Bild optimieren VOR dem Upload
    const optimized = await optimizeImage(file, {
      maxWidth: 1920,
      quality: 80,
      format: 'webp',
    });
    
    // Optimiertes Bild zu Cloudinary hochladen
    const cloudinaryFormData = new FormData();
    const optimizedFile = new File(
      [new Uint8Array(optimized.buffer)], 
      file.name.replace(/\.[^.]+$/, '') + '.webp', // .webp Endung
      { type: 'image/webp' }
    );
    cloudinaryFormData.append('file', optimizedFile);
    cloudinaryFormData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET!);
    cloudinaryFormData.append('folder', 'maurer-events');
    
    const uniqueId = crypto.randomUUID();
    cloudinaryFormData.append("public_id", uniqueId);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: cloudinaryFormData }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Upload fehlgeschlagen');
    }
    
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      originalSize: file.size,
      optimizedSize: optimized.size,
      savings: `${(100 - (optimized.size / file.size) * 100).toFixed(1)}%`,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: error instanceof Error && error.message ? error.message : "Failed to upload image" };
  }
}
