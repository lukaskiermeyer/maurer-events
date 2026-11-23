// Wandelt das bestehende globale Tisch-Raster in ein Plan-Preset "Bestand" um
// und weist es allen aktiven Events zu. Tisch-UUIDs bleiben als Element-IDs
// erhalten, damit bestehende Zuweisungen weiter funktionieren. Idempotent.
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
const CELL = 120;

try {
  const tables = await sql`SELECT * FROM tables ORDER BY display_number NULLS LAST, name`;
  if (tables.length === 0) {
    console.log('Keine Bestand-Tische vorhanden — nichts zu migrieren.');
    process.exit(0);
  }
  const [tentRow] = await sql`SELECT value FROM settings WHERE key = 'tent_dimensions'`;
  const tent = tentRow ? JSON.parse(tentRow.value) : { width: 10, height: 8 };

  const existing = await sql`SELECT id FROM plan_presets WHERE name = 'Bestand (altes Raster)'`;
  let presetId = existing[0]?.id;

  if (!presetId) {
    const elements = [];
    let maxX = 0, maxY = 0;
    tables.forEach((t, i) => {
      maxX = Math.max(maxX, t.position_x + 1);
      maxY = Math.max(maxY, t.position_y + 1);
      const num = parseInt(String(t.display_number ?? '').replace(/\D/g, ''), 10);
      elements.push({
        kind: 'table', id: t.id,
        x: t.position_x * CELL + 5, y: t.position_y * CELL + 5,
        w: Math.round((t.width_m ?? 1.1) * 100), h: Math.round((t.height_m ?? 1.1) * 100),
        number: Number.isFinite(num) && num > 0 ? num : i + 1,
        capacity: t.capacity, shape: t.shape === 'round' ? 'round' : 'rect',
        vip: t.is_vip || undefined, blocked: t.is_blocked || undefined,
        rowLabel: t.row_label ?? undefined,
      });
    });
    const widthCm = Math.max(tent.width ?? 0, maxX) * CELL + 120;
    const heightCm = Math.max(tent.height ?? 0, maxY) * CELL + 120;
    elements.unshift({ kind: 'area', id: crypto.randomUUID(), x: 0, y: 0, w: widthCm - 120, h: heightCm - 120, label: 'Zelt', color: '#D9D9D9' });
    for (const f of tent.features ?? []) {
      const base = { id: crypto.randomUUID(), x: f.x * CELL, y: f.y * CELL, w: f.w * CELL, h: f.h * CELL };
      if (f.kind === 'stage') elements.push({ ...base, kind: 'stage', label: f.label ?? 'Bühne' });
      else if (f.kind === 'bar') elements.push({ ...base, kind: 'area', label: f.label ?? 'Theke', color: '#5F8575' });
      else if (f.kind === 'entrance') elements.push({ ...base, kind: 'area', label: f.label ?? 'Eingang', color: '#F4F0E8' });
      else elements.push({ ...base, kind: 'area', label: f.label ?? 'Gesperrt', color: '#9CA3AF' });
    }
    const layout = { version: 1, widthCm, heightCm, tablePrefix: 'T', nextNumber: tables.length + 1, elements };
    const [row] = await sql`INSERT INTO plan_presets (name, description, layout) VALUES ('Bestand (altes Raster)', 'Automatisch aus dem alten Zelt-Raster übernommen (Migration 0045).', ${JSON.stringify(layout)}::jsonb) RETURNING id`;
    presetId = row.id;
    console.log(`Preset "Bestand (altes Raster)" angelegt: ${tables.length} Tische, ${widthCm / 100}×${heightCm / 100} m.`);
  } else {
    console.log('Preset "Bestand (altes Raster)" existiert bereits — verwende es erneut.');
  }

  await sql.begin(async tx => {
    const ev = await tx`UPDATE events SET plan_preset_id = ${presetId} WHERE deleted_at IS NULL AND plan_preset_id IS NULL RETURNING id`;
    const res = await tx`UPDATE reservations SET plan_table_id = table_id WHERE table_id IS NOT NULL AND plan_table_id IS NULL RETURNING id`;
    console.log(`${ev.length} Events das Preset zugewiesen, ${res.length} Reservierungs-Zuweisungen übernommen.`);
  });
  console.log('Bestand-Migration abgeschlossen.');
} catch (e) {
  console.error('FEHLER:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}