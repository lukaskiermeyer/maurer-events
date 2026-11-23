"use server";

import { requireAdmin } from "@/lib/auth";
import { translateFields } from "@/lib/translate";

// On-Demand-KI-Übersetzung (NIM) für die Sprach-Tabs im Admin-CMS.
// Liefert { en: {feld: text}, bar: {feld: text} }; ohne NIM_API_KEY fail-open Originaltext.
export async function translateTextsNow(fields: Record<string, string>): Promise<{ en: Record<string, string | null>; bar: Record<string, string | null> }> {
  await requireAdmin();
  const cleaned = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v ?? "").trim()]));
  const t = await translateFields(cleaned);
  return { en: t.en ?? {}, bar: t.bar ?? {} };
}