"use server";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      throw new Error("No file uploaded");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename
    const uniqueId = crypto.randomUUID();
    const filename = `${uniqueId}.webp`;
    
    // Ensure the uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filepath = path.join(uploadsDir, filename);

    // Process image with sharp:
    // This strips EXIF data and any hidden malicious payloads because sharp
    // decodes the image pixels and re-encodes them into a fresh WebP container.
    await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true }) // Max width 1920px
      .webp({ quality: 80 }) // Convert to WebP for optimization
      .toFile(filepath);

    // Return the public URL
    return { success: true, url: `/uploads/${filename}` };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Failed to upload image" };
  }
}
