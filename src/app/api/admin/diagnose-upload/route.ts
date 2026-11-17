import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const config = {
      cloudName: cloudName ? `${cloudName.slice(0, 4)}...` : "MISSING",
      apiKey: apiKey ? `${apiKey.slice(0, 4)}...` : "MISSING",
      apiSecret: apiSecret ? "SET" : "MISSING",
    };

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, config, error: "Cloudinary-Umgebungsvariablen fehlen." }, { status: 500 });
    }

    // Test: signierter Upload eines minimalen Testbildes (1x1 PNG)
    const testBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "maurer-events/_diagnose";
    const publicId = `diag-${crypto.randomUUID()}`;
    const params = { folder, public_id: publicId, timestamp };
    const base = Object.keys(params).sort().map(k => `${k}=${params[k as keyof typeof params]}`).join("&");
    const signature = crypto.createHash("sha1").update(`${base}${apiSecret}`).digest("hex");

    const form = new FormData();
    form.append("file", new Blob([testBuffer], { type: "image/png" }), "test.png");
    form.append("api_key", apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("public_id", publicId);
    form.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          config,
          cloudinaryStatus: response.status,
          cloudinaryError: data?.error?.message || "Unbekannter Fehler",
          hint: response.status === 403
            ? "Der Cloudinary API-Schlüssel hat keine 'Create assets'-Berechtigung. In Cloudinary Console → Settings → API Keys → Permissions aktivieren."
            : "Cloudinary-Upload fehlgeschlagen. Details oben.",
        },
        { status: 500 }
      );
    }

    // Aufräumen: Test-Asset löschen
    try {
      const delTimestamp = Math.floor(Date.now() / 1000).toString();
      const delParams = { public_id: data.public_id, timestamp: delTimestamp };
      const delBase = Object.keys(delParams).sort().map(k => `${k}=${delParams[k as keyof typeof delParams]}`).join("&");
      const delSignature = crypto.createHash("sha1").update(`${delBase}${apiSecret}`).digest("hex");
      const delForm = new FormData();
      delForm.append("public_id", data.public_id);
      delForm.append("api_key", apiKey);
      delForm.append("timestamp", delTimestamp);
      delForm.append("signature", delSignature);
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body: delForm,
      });
    } catch {
      // Best-effort cleanup
    }

    return NextResponse.json({
      ok: true,
      config,
      message: "Cloudinary-Upload funktioniert. Der API-Schlüssel hat die nötigen Berechtigungen.",
      testUrl: data.secure_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}