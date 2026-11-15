// Cloudinary-Permission-Test: List + Upload + Delete mit Root-Key
// Verwendung: npx tsx scripts/test-cloudinary-permissions.ts
// Läuft NUR mit Werten aus .env.local (CLOUDINARY_CLOUD_NAME etc.) – Secrets werden nie geloggt.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createHash } from "node:crypto";

const cloud = process.env.CLOUDINARY_CLOUD_NAME || "";
const key = process.env.CLOUDINARY_API_KEY || "";
const secret = process.env.CLOUDINARY_API_SECRET || "";
if (!cloud || !key || !secret || key.includes("<")) throw new Error("CLOUDINARY_* fehlt oder ist Platzhalter in .env.local (Root-Key eintragen, ohne < >).");

const basic = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
function sign(params: Record<string, string>, s: string) {
  const base = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(`${base}${s}`).digest("hex");
}

async function main() {
  console.log("Cloud:", cloud);
  // 1) List (Read-Permission)
  const list = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image?prefix=maurer-events&max_results=5`, { headers: { Authorization: basic } });
  console.log("LIST:", list.status, list.ok ? "ok" : (await list.text()).slice(0, 300));
  // 2) Upload Test-PNG (Create-Permission)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const ts = Math.floor(Date.now() / 1000).toString();
  const pid = `test-perm-${Date.now()}`;
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }));
  body.append("api_key", key); body.append("timestamp", ts);
  body.append("folder", "maurer-events"); body.append("public_id", pid);
  body.append("signature", sign({ folder: "maurer-events", public_id: pid, timestamp: ts }, secret));
  const up = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body });
  const data = await up.json().catch(() => null) as any;
  console.log("UPLOAD:", up.status, data?.secure_url || data?.error?.message || "ok");
  if (data?.secure_url) {
    // 3) Delete (Destroy-Permission)
    const ts2 = Math.floor(Date.now() / 1000).toString();
    const delBody = new URLSearchParams({ public_id: data.public_id, api_key: key, timestamp: ts2, signature: sign({ public_id: data.public_id, timestamp: ts2 }, secret) });
    const del = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: "POST", body: delBody });
    console.log("DELETE:", del.status, (await del.json().catch(() => ({}))) as any);
  }
  console.log("Fertig – wenn Upload+Delete ok sind, läuft der Mitarbeiter-Upload.");
  if (!list.ok || !data?.secure_url) { console.error("❌ Berechtigung fehlt – bitte Root-Key/Permissions prüfen."); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
