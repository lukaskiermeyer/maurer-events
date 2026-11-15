import crypto from "crypto";

export function getImageUrl(
  publicId: string,
  options?: { width?: number; height?: number; quality?: number; format?: string }
): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return publicId; // Fallback falls keine env vorliegt oder URL schon komplett ist
  }

  if (publicId.startsWith('http')) {
     return publicId;
  }

  const transforms: string[] = [];
  if (options?.width) transforms.push(`w_${options.width}`);
  if (options?.height) transforms.push(`h_${options.height}`);
  if (options?.quality) transforms.push(`q_${options.quality}`);
  if (options?.format) transforms.push(`f_${options.format}`);

  // Im Projekt werden Bilder als 'auto' format/quality ausgeliefert, wenn nicht spezifiziert
  if (transforms.length === 0) {
    transforms.push("f_auto,q_auto");
  }

  const transformString = transforms.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/maurer-events/${publicId}`;
}

export async function deleteCloudinaryImage(url: string): Promise<boolean> {
  // Wenn es noch eine alte Vercel Blob URL ist, können wir sie ohne das vercel/blob package nicht mehr löschen
  if (url.includes('public.blob.vercel-storage.com')) {
    console.warn("WARNING: Cannot delete orphaned Vercel blob image (URL redacted).");
    return false;
  }
  if (!url.includes('res.cloudinary.com')) return false;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary credentials missing for deletion.");
    return false;
  }

  try {
    // Resource-Typ aus dem URL-Pfad (image/raw/video). Default image.
    const rtMatch = url.match(/\/(image|raw|video)\/upload\//);
    const resourceType = rtMatch ? rtMatch[1] : "image";

    // public_id: alles unter "maurer-events/" bis zur Dateiendung.
    // Funktioniert auch für verschachtelte Ordner (maurer-events/staff/<uuid>, maurer-events/documents/<uuid>)
    // und für transformierte/Versionierungs-URLs.
    const idMatch = url.match(/maurer-events\/([^?#]+)/);
    if (!idMatch || !idMatch[1]) {
      console.error("Could not extract publicId from Cloudinary URL (redacted).");
      return false;
    }
    const publicId = `maurer-events/${idMatch[1]}`.replace(/\.[a-zA-Z0-9]+$/, "");

    const timestamp = Math.round(new Date().getTime() / 1000).toString();

    // SHA-1 Signature generieren (alphabetisch sortierte Parameter + Secret)
    const params: Record<string, string> = {
      invalidate: "true",
      public_id: publicId,
      timestamp,
    };
    const base = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
    const signature = crypto.createHash('sha1').update(`${base}${apiSecret}`).digest('hex');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('invalidate', 'true');
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.result !== 'ok') {
      console.error("Cloudinary destroy failed", { status: response.status, result });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return false;
  }
}