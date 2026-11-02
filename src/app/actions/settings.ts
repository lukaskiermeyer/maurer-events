"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { validateEventSettings } from "@/lib/event-settings";
import { lockLayout } from '@/lib/reservation-db';
import { BookingError } from '@/lib/reservation-policy';
import type { FoodPackage, PackagePreset } from '@/types/domain';

const TENT_KEY = "tent_dimensions";
const PRESETS_KEY = "package_presets";
const MAX_PRESETS = 20;

export async function getTentSettings() {
  const result = await db.select().from(settings).where(eq(settings.key, TENT_KEY));
  if (result.length > 0) {
    return JSON.parse(result[0].value);
  }
  // Default to 10x8 if not set
  return { width: 10, height: 8 };
}

export async function saveTentSettings(width: number, height: number) {
  await requireAdmin();
  if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= 10000)) throw new BookingError('Ungültige Zeltdimensionen.');
  const value = JSON.stringify({ width, height });
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    await tx.insert(settings).values({ key: TENT_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
}

// Gespeicherte Paket-Vorlagen sind reine Startpunkte: Beim Anwenden werden die
// Pakete in das Event kopiert und bleiben dort unabhängig weiter editierbar.
function parsePresets(raw: string | undefined): PackagePreset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(entry => {
      if (!entry || typeof entry !== 'object') return [];
      const { name, packages } = entry as { name?: unknown; packages?: unknown };
      if (typeof name !== 'string' || !name.trim() || !Array.isArray(packages)) return [];
      return [{ name: name.trim(), packages: packages as FoodPackage[] }];
    });
  } catch {
    return [];
  }
}

export async function getPackagePresets(): Promise<PackagePreset[]> {
  await requireAdmin();
  const [row] = await db.select().from(settings).where(eq(settings.key, PRESETS_KEY));
  return parsePresets(row?.value);
}

export async function savePackagePreset(name: string, packages: unknown) {
  await requireAdmin();
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw new BookingError('Bitte einen Namen für die Vorlage angeben.');
  if (cleanName.length > 60) throw new BookingError('Der Name der Vorlage darf höchstens 60 Zeichen lang sein.');
  const cleanPackages = (validateEventSettings({ packages }).packages ?? []) as FoodPackage[];

  await db.transaction(async tx => {
    await lockLayout(tx, true);
    const [row] = await tx.select().from(settings).where(eq(settings.key, PRESETS_KEY));
    const existing = parsePresets(row?.value);
    const withoutSameName = existing.filter(preset => preset.name.toLowerCase() !== cleanName.toLowerCase());
    if (!existing.some(preset => preset.name.toLowerCase() === cleanName.toLowerCase()) && existing.length >= MAX_PRESETS) {
      throw new BookingError(`Es sind höchstens ${MAX_PRESETS} Vorlagen möglich.`);
    }
    const next = [...withoutSameName, { name: cleanName, packages: cleanPackages }]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const value = JSON.stringify(next);
    await tx.insert(settings).values({ key: PRESETS_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });

  revalidatePath('/[locale]', 'layout');
}

export async function deletePackagePreset(name: string) {
  await requireAdmin();
  if (typeof name !== 'string' || !name.trim()) throw new BookingError('Ungültige Vorlage.');
  await db.transaction(async tx => {
    await lockLayout(tx, true);
    const [row] = await tx.select().from(settings).where(eq(settings.key, PRESETS_KEY));
    const next = parsePresets(row?.value).filter(preset => preset.name !== name);
    const value = JSON.stringify(next);
    await tx.insert(settings).values({ key: PRESETS_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  });
  revalidatePath('/[locale]', 'layout');
}