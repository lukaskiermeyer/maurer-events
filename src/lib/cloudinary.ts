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
    console.warn(`WARNING: Cannot delete orphaned Vercel blob image: ${url}`);
    return false;
  }

  // Cloudinary URL Format: https://res.cloudinary.com/<cloud>/image/upload/<transformations>/<folder>/<public_id>.<ext>
  // Wir müssen die publicId extrahieren.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary credentials missing for deletion.");
    return false;
  }

  try {
    // Extrahieren der public_id (alles nach maurer-events/ ohne die Dateiendung)
    const folderMatch = url.match(/\/maurer-events\/([^/.]+)/);
    if (!folderMatch || !folderMatch[1]) {
      console.error("Could not extract publicId from Cloudinary URL", url);
      return false;
    }
    
    // public_id beinhaltet auch den Folder in Cloudinary
    const publicId = `maurer-events/${folderMatch[1]}`;
    const timestamp = Math.round(new Date().getTime() / 1000).toString();

    // SHA-1 Signature generieren
    // Format: public_id=<public_id>&timestamp=<timestamp><api_secret>
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    return result.result === 'ok';
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return false;
  }
}
