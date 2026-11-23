// Plan-Dokument für Tischplan-Presets. Alle Koordinaten/Maxi in cm.
// IDs von Tischen sind stabil (Bestand-Preset nutzt die alten Tisch-UUIDs),
// damit Reservierungs-Zuweisungen einen Preset-Wechsel überleben.

export interface PlanTable {
  kind: 'table';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  number: number;
  capacity: number;
  shape: 'rect' | 'round';
  vip?: boolean;
  blocked?: boolean;
  rowLabel?: string;
  rowId?: string;
  areaId?: string;
  vertical?: boolean;
  benchDepth?: number;
  benchGap?: number;
}

export interface PlanWall {
  kind: 'wall';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Tür = Öffnung in einer Wand (oder der Zeltgrenze). Sitzt immer in einer Wand,
// Breite entlang der Wandachse (220/250 cm Standard, 500 cm Haupteingang).
export interface PlanDoor {
  kind: 'door';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  wallId: string;
  vertical: boolean;
}

export interface PlanRow {
  kind: 'row';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string;
  areaId?: string;
  stackVertical?: boolean;
  spacing?: { gapTables: number; gapRows: number; gapInner: number; double: boolean };
}

export interface PlanArea {
  kind: 'area';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

export interface PlanBoundary {
  kind: 'boundary';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface PlanStage {
  kind: 'stage';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface PlanLabel {
  kind: 'label';
  id: string;
  x: number;
  y: number;
  text: string;
  size?: number;
}

export type PlanElement = PlanTable | PlanArea | PlanBoundary | PlanStage | PlanLabel | PlanRow | PlanWall | PlanDoor;

export interface PlanLayout {
  version: 1;
  widthCm: number;
  heightCm: number;
  tablePrefix: string;
  nextNumber: number;
  numbering?: NumberingOptions;
  elements: PlanElement[];
}

export const DEFAULT_LAYOUT: PlanLayout = {
  version: 1,
  widthCm: 4000,
  heightCm: 6000,
  tablePrefix: 'T',
  nextNumber: 1,
  elements: [],
};

// Reine Farbpalette ohne Bereichs-Bezeichnung: die Farbe wählt der Nutzer,
// den Namen vergibt er selbst im Beschriftungsfeld.
export const AREA_COLORS = [
  '#D9D9D9', '#2ECC71', '#5F8575', '#DFF5E1', '#8B4A2B', '#1A1A1A', '#1F78B4', '#F4F0E8',
];

export function planTables(layout: PlanLayout): PlanTable[] {
  return layout.elements.filter((el): el is PlanTable => el.kind === 'table');
}

export function tableLabel(layout: PlanLayout, table: PlanTable): string {
  const o = layout.numbering;
  if (o && (o.scheme === 'rowTable' || o.scheme === 'oddEven') && table.rowId) {
    const rowNum = rowIndex(layout, table.rowId, o) + o.rowStart - 1;
    return `${rowNum}.${String(table.number).padStart(2, '0')}`;
  }
  return `${layout.tablePrefix}${String(table.number).padStart(3, '0')}`;
}

export function findTable(layout: PlanLayout, id: string): PlanTable | undefined {
  return layout.elements.find((el): el is PlanTable => el.kind === 'table' && el.id === id);
}

export type TableOccupancy = { kind: "free" | "reserved" | "vip" | "blocked"; guests: number; names?: string[] };

export const OCCUPANCY_STATUSES = ["paid", "confirmed", "checked_in"];
export const INACTIVE_STATUSES = ["cancelled", "expired", "declined", "refunded"];

export interface OccupancyReservation {
  planTableId: string | null;
  tableId: string | null;
  guestCount: number;
  guestName: string;
  status: string;
  reservationDate: Date | string;
}

export function dayKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

// Bestand-Presets nutzen die alten Tisch-UUIDs als Element-IDs; ältere
// Zuweisungen haben nur table_id — deshalb der Fallback.
export function buildOccupancy(layout: PlanLayout, rows: OccupancyReservation[], date: string): Record<string, TableOccupancy> {
  const map: Record<string, TableOccupancy> = {};
  for (const t of planTables(layout)) {
    map[t.id] = { kind: t.blocked ? "blocked" : t.vip ? "vip" : "free", guests: 0, names: [] };
  }
  for (const r of rows) {
    if (!OCCUPANCY_STATUSES.includes(r.status) || dayKey(r.reservationDate) !== date) continue;
    const id = r.planTableId ?? r.tableId;
    const entry = id ? map[id] : undefined;
    if (!entry || entry.kind === "blocked") continue;
    entry.guests += r.guestCount;
    entry.names?.push(r.guestName);
    if (entry.guests > 0) entry.kind = "reserved";
  }
  return map;
}

export interface RowSpec {
  areaId: string | null;
  tablesPerRow: number;
  rowCount: number;
  tableVertical: boolean;
  stackVertical: boolean;
  shape: 'rect' | 'round';
  tableW: number;
  tableH: number;
  benchDepth: number;
  benchGap: number;
  capacity: number;
  gapTables: number;
  gapRows: number;
  double: boolean;
  gapInner: number;
}

export const DEFAULT_ROW_SPEC: RowSpec = {
  areaId: null, tablesPerRow: 6, rowCount: 2, tableVertical: false, stackVertical: false, shape: 'rect',
  tableW: 220, tableH: 50, benchDepth: 25, benchGap: 10, capacity: 8, gapTables: 20, gapRows: 250, double: false, gapInner: 20,
};

// Gesamtmaß einer Garnitur: Platte + zwei Bänke + Bank-Tisch-Abstände.
export function garniturFootprint(tableW: number, tableH: number, benchDepth: number, benchGap: number, vertical: boolean) {
  const short = tableH + 2 * (benchDepth + benchGap);
  return vertical ? { w: short, h: tableW } : { w: tableW, h: short };
}

export function planRows(layout: PlanLayout): PlanRow[] {
  return layout.elements.filter((el): el is PlanRow => el.kind === 'row');
}

export function tablesOfRow(layout: PlanLayout, rowId: string): PlanTable[] {
  return planTables(layout).filter(t => t.rowId === rowId);
}

export function parentOf(layout: PlanLayout, id: string): string | null {
  const el = layout.elements.find(e => e.id === id);
  if (!el) return null;
  if (el.kind === 'table') return el.rowId ?? el.areaId ?? null;
  if (el.kind === 'row') return el.areaId ?? null;
  if (el.kind === 'door') return el.wallId;
  return null;
}

export function isAncestorOf(layout: PlanLayout, ancestorId: string, id: string): boolean {
  let cur = parentOf(layout, id);
  while (cur) {
    if (cur === ancestorId) return true;
    cur = parentOf(layout, cur);
  }
  return false;
}

export function childrenOf(layout: PlanLayout, id: string): PlanElement[] {
  const el = layout.elements.find(e => e.id === id);
  if (!el) return [];
  // Zeltgrenze ist eine vollwertige Gruppe ("Zelt"): Reihen/Tische darin gehören dazu.
  if (el.kind === 'area' || el.kind === 'boundary') return layout.elements.filter(e => ((e.kind === 'row' || e.kind === 'table') && e.areaId === id) || (e.kind === 'door' && e.wallId === id));
  if (el.kind === 'wall') return layout.elements.filter(e => e.kind === 'door' && e.wallId === id);
  if (el.kind === 'row') return layout.elements.filter(e => e.kind === 'table' && e.rowId === id);
  return [];
}

export const DOOR_WIDTHS = [220, 250, 500];

// Tür-Position auf einer Wand: entlang der Wandachse projiziert und begrenzt.
export function doorOnWall(wall: { x: number; y: number; w: number; h: number }, cx: number, cy: number, width: number): { x: number; y: number; w: number; h: number; vertical: boolean } | null {
  const vertical = wall.h > wall.w;
  if (vertical) {
    if (cx < wall.x - 80 || cx > wall.x + wall.w + 80 || cy < wall.y - width / 2 || cy > wall.y + wall.h + width / 2) return null;
    const y = Math.min(Math.max(cy - width / 2, wall.y), wall.y + wall.h - width);
    return { x: wall.x, y, w: wall.w, h: width, vertical };
  }
  if (cy < wall.y - 80 || cy > wall.y + wall.h + 80 || cx < wall.x - width / 2 || cx > wall.x + wall.w + width / 2) return null;
  const x = Math.min(Math.max(cx - width / 2, wall.x), wall.x + wall.w - width);
  return { x, y: wall.y, w: width, h: wall.h, vertical };
}

const BOUNDARY_WALL_T = 24;

// Zeltgrenze = vier Wandsegmente (oben/unten/links/rechts), damit Türen als
// schmale Öffnungen auf der Zeltkante sitzen statt über das ganze Zelt.
function wallSegments(el: PlanWall | PlanBoundary): { x: number; y: number; w: number; h: number }[] {
  if (el.kind === 'wall') return [el];
  const t = BOUNDARY_WALL_T;
  return [
    { x: el.x, y: el.y, w: el.w, h: t },
    { x: el.x, y: el.y + el.h - t, w: el.w, h: t },
    { x: el.x, y: el.y, w: t, h: el.h },
    { x: el.x + el.w - t, y: el.y, w: t, h: el.h },
  ];
}

export function nearestWallDoor(layout: PlanLayout, cx: number, cy: number, width: number): { rect: { x: number; y: number; w: number; h: number }; wallId: string; vertical: boolean } | null {
  let best: { rect: { x: number; y: number; w: number; h: number }; wallId: string; vertical: boolean; dist: number } | null = null;
  for (const el of layout.elements) {
    if (el.kind !== 'wall' && el.kind !== 'boundary') continue;
    for (const seg of wallSegments(el)) {
      const r = doorOnWall(seg, cx, cy, width);
      if (!r) continue;
      const dist = Math.hypot(cx - (r.x + r.w / 2), cy - (r.y + r.h / 2));
      if (!best || dist < best.dist) best = { rect: { x: r.x, y: r.y, w: r.w, h: r.h }, wallId: el.id, vertical: r.vertical, dist };
    }
  }
  return best;
}

export function descendantIds(layout: PlanLayout, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const child of childrenOf(layout, pid)) { out.push(child.id); walk(child.id); }
  };
  walk(id);
  return out;
}

export function moveGroup(layout: PlanLayout, id: string, dx: number, dy: number): PlanLayout {
  const ids = new Set([id, ...descendantIds(layout, id)]);
  return { ...layout, elements: layout.elements.map(el => ids.has(el.id) && 'x' in el ? { ...el, x: el.x + dx, y: el.y + dy } : el) };
}

function hitTable(layout: PlanLayout, x: number, y: number): PlanTable | null {
  const tables = planTables(layout);
  for (let i = tables.length - 1; i >= 0; i--) {
    const t = tables[i];
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
  }
  return null;
}

function hitRow(layout: PlanLayout, x: number, y: number): PlanRow | null {
  const rows = planRows(layout);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

function hitArea(layout: PlanLayout, x: number, y: number): PlanArea | null {
  const areas = layout.elements.filter((el): el is PlanArea => el.kind === 'area');
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a;
  }
  return null;
}

// Immer die höchste Gruppe unter dem Cursor: Bereich › Reihe › Tisch.
export function highestGroupAt(layout: PlanLayout, x: number, y: number): string | null {
  const table = hitTable(layout, x, y);
  if (table) return table.areaId ?? table.rowId ?? table.id;
  const row = hitRow(layout, x, y);
  if (row) return row.areaId ?? row.id;
  const area = hitArea(layout, x, y);
  if (area) return area.id;
  const doors = layout.elements.filter((el): el is PlanDoor => el.kind === 'door');
  for (let i = doors.length - 1; i >= 0; i--) {
    const d = doors[i];
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.wallId;
  }
  const leaf = [...layout.elements].reverse().find(el => {
    if (el.kind === 'label') return x >= el.x - 20 && x <= el.x + 200 && y >= el.y - 60 && y <= el.y + 20;
    if (el.kind === 'stage' || el.kind === 'boundary' || el.kind === 'wall') return x >= el.x - 20 && x <= el.x + el.w + 20 && y >= el.y - 20 && y <= el.y + el.h + 20;
    return false;
  });
  return leaf?.id ?? null;
}

// Doppelklick: eine Ebene tiefer innerhalb der aktuellen Auswahl.
export function drillDownAt(layout: PlanLayout, selectedId: string, x: number, y: number): string | null {
  const sel = layout.elements.find(e => e.id === selectedId);
  if (!sel) return null;
  const table = hitTable(layout, x, y);
  const row = hitRow(layout, x, y);
  if (sel.kind === 'area' || sel.kind === 'boundary') {
    if (row && row.areaId === sel.id) return row.id;
    if (table && table.areaId === sel.id) return table.rowId ?? table.id;
  }
  if (sel.kind === 'wall' || sel.kind === 'boundary') {
    const door = layout.elements.find((el): el is PlanDoor => el.kind === 'door' && el.wallId === sel.id && x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h);
    if (door) return door.id;
  }
  if (sel.kind === 'row') return table && table.rowId === sel.id ? table.id : null;
  return null;
}

// Nummerierungs-Schemata nach üblicher Praxis:
// continuous = Bierzelt fortlaufend; zones = Vereinsfest-Nummernkreise je Bereich;
// rowTable = Koordinaten Reihe.Tisch; oddEven = Theater/französische Art ab Mittelgang.
export type NumberingScheme = 'continuous' | 'zones' | 'rowTable' | 'oddEven';

export interface NumberingOptions {
  scheme: NumberingScheme;
  prefix: string;
  start: number;
  rowPrefix: string;
  rowStart: number;
  rowStyle: 'long' | 'short' | 'alpha';
  direction: 'rows' | 'columns';
  reverse: boolean;
  zoneStarts: Record<string, number>;
  oddLeft: boolean;
}

export const DEFAULT_NUMBERING: NumberingOptions = {
  scheme: 'continuous', prefix: 'T', start: 1, rowPrefix: 'Reihe ', rowStart: 1, rowStyle: 'long',
  direction: 'rows', reverse: false, zoneStarts: {}, oddLeft: true,
};

export function sortedRows(layout: PlanLayout, opts: NumberingOptions): PlanRow[] {
  const rows = [...planRows(layout)].sort((a, b) => opts.direction === 'rows' ? (a.y - b.y || a.x - b.x) : (a.x - b.x || a.y - b.y));
  return opts.reverse ? rows.reverse() : rows;
}

export function rowIndex(layout: PlanLayout, rowId: string, opts?: NumberingOptions): number {
  const o = opts ?? layout.numbering ?? DEFAULT_NUMBERING;
  return sortedRows(layout, o).findIndex(r => r.id === rowId) + 1;
}

function rowLabelText(opts: NumberingOptions, i: number): string {
  const n = i + opts.rowStart;
  if (opts.rowStyle === 'short') return `R${n}`;
  if (opts.rowStyle === 'alpha') return String.fromCharCode(64 + n);
  return `${opts.rowPrefix}${n}`;
}

function orderTables(layout: PlanLayout, tables: PlanTable[], row: PlanRow | null, reverse: boolean): PlanTable[] {
  const vertical = row ? rowStackVertical(row) : false;
  const sorted = [...tables].sort((a, b) => vertical ? (a.y - b.y || a.x - b.x) : (a.x - b.x || a.y - b.y));
  return reverse ? sorted.reverse() : sorted;
}

export function applyNumbering(layout: PlanLayout, opts: NumberingOptions): PlanLayout {
  const rows = sortedRows(layout, opts);
  const rowLabelById = new Map<string, string>();
  rows.forEach((r, i) => rowLabelById.set(r.id, rowLabelText(opts, i)));
  const numberById = new Map<string, number>();
  let next = opts.start;
  const freeTables = planTables(layout).filter(t => !t.rowId);
  if (opts.scheme === 'zones') {
    const areaIds = [...new Set(planTables(layout).map(t => t.areaId ?? 'frei'))];
    areaIds.sort((a, b) => {
      const ta = planTables(layout).find(t => (t.areaId ?? 'frei') === a)!;
      const tb = planTables(layout).find(t => (t.areaId ?? 'frei') === b)!;
      return ta.y - tb.y || ta.x - tb.x;
    });
    areaIds.forEach((aid, idx) => {
      let n = opts.zoneStarts[aid] ?? (idx + 1) * 100;
      for (const row of rows) for (const t of orderTables(layout, tablesOfRow(layout, row.id), row, opts.reverse)) if ((t.areaId ?? 'frei') === aid) numberById.set(t.id, n++);
      for (const t of orderTables(layout, freeTables.filter(t => (t.areaId ?? 'frei') === aid), null, opts.reverse)) numberById.set(t.id, n++);
    });
  } else {
    for (const row of rows) {
      const ts = orderTables(layout, tablesOfRow(layout, row.id), row, opts.reverse);
      if (opts.scheme === 'continuous') {
        for (const t of ts) numberById.set(t.id, next++);
      } else if (opts.scheme === 'rowTable') {
        ts.forEach((t, i) => numberById.set(t.id, i + 1));
      } else {
        const vertical = rowStackVertical(row);
        const mid = (t: PlanTable) => vertical ? t.y + t.h / 2 : t.x + t.w / 2;
        const center = ts.reduce((s, t) => s + mid(t), 0) / Math.max(1, ts.length);
        const leftOut = ts.filter(t => mid(t) < center).reverse();
        const rightOut = ts.filter(t => mid(t) >= center);
        leftOut.forEach((t, i) => numberById.set(t.id, opts.oddLeft ? 2 * i + 1 : 2 * i + 2));
        rightOut.forEach((t, i) => numberById.set(t.id, opts.oddLeft ? 2 * i + 2 : 2 * i + 1));
      }
    }
    const free = orderTables(layout, freeTables, null, opts.reverse);
    if (opts.scheme === 'continuous') for (const t of free) numberById.set(t.id, next++);
    else free.forEach((t, i) => numberById.set(t.id, i + 1));
  }
  return {
    ...layout,
    numbering: opts,
    tablePrefix: opts.prefix,
    nextNumber: next,
    elements: layout.elements.map(el => {
      if (el.kind === 'row') return { ...el, label: rowLabelById.get(el.id) ?? el.label };
      if (el.kind === 'table') {
        const rowLabel = el.rowId ? rowLabelById.get(el.rowId) : undefined;
        return { ...el, number: numberById.get(el.id) ?? el.number, rowLabel: rowLabel ?? el.rowLabel };
      }
      return el;
    }),
  };
}

export function rowBlockGeometry(spec: RowSpec, ox: number, oy: number) {
  const foot = garniturFootprint(spec.tableW, spec.tableH, spec.benchDepth, spec.benchGap, spec.tableVertical);
  const cellW = foot.w;
  const cellH = foot.h;
  const alongVertical = spec.stackVertical;
  const cellAlong = alongVertical ? cellH : cellW;
  const cellAcross = alongVertical ? cellW : cellH;
  const acrossOffset = (r: number) => {
    if (!spec.double) return r * (cellAcross + spec.gapRows);
    const pair = Math.floor(r / 2);
    const within = r % 2;
    return pair * (2 * cellAcross + spec.gapInner + spec.gapRows) + within * (cellAcross + spec.gapInner);
  };
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < spec.rowCount; r++) {
    for (let c = 0; c < spec.tablesPerRow; c++) {
      const along = c * (cellAlong + spec.gapTables);
      const across = acrossOffset(r);
      cells.push(alongVertical ? { x: ox + across, y: oy + along, w: cellW, h: cellH } : { x: ox + along, y: oy + across, w: cellW, h: cellH });
    }
  }
  const pairs = Math.ceil(spec.rowCount / 2);
  const blockAlong = spec.tablesPerRow * cellAlong + (spec.tablesPerRow - 1) * spec.gapTables;
  const blockAcross = spec.double
    ? pairs * (2 * cellAcross + spec.gapInner) + (pairs - 1) * spec.gapRows
    : spec.rowCount * cellAcross + (spec.rowCount - 1) * spec.gapRows;
  return { cells, w: alongVertical ? blockAcross : blockAlong, h: alongVertical ? blockAlong : blockAcross };
}

export const rowStackVertical = (row: PlanRow) => row.stackVertical ?? row.rotation % 180 !== 0;

export interface Dimension { x1: number; y1: number; x2: number; y2: number; label: string }

// Maßketten wie im Zelt-Entwurf: Gänge zwischen Reihenblöcken, Bühne→Reihe, Wandabstände.
export function computeDimensions(layout: PlanLayout): Dimension[] {
  const dims: Dimension[] = [];
  const rows = [...planRows(layout)].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i + 1 < rows.length && dims.length < 30; i++) {
    const a = rows[i], b = rows[i + 1];
    if (!rowStackVertical(a) && !rowStackVertical(b)) {
      const gap = b.y - (a.y + a.h);
      if (gap > 0) dims.push({ x1: Math.min(a.x, b.x) - 80, y1: a.y + a.h, x2: Math.min(a.x, b.x) - 80, y2: b.y, label: `${Math.round(gap)} cm` });
    } else if (rowStackVertical(a) && rowStackVertical(b)) {
      const gap = b.x - (a.x + a.w);
      if (gap > 0) dims.push({ x1: a.x + a.w, y1: Math.min(a.y, b.y) - 80, x2: b.x, y2: Math.min(a.y, b.y) - 80, label: `${Math.round(gap)} cm` });
    }
  }
  // Wichtigste Stellen: Zeltmaße, erste Reihen-Länge, erste Garnitur im Gesamtmaß.
  dims.push({ x1: 0, y1: -60, x2: layout.widthCm, y2: -60, label: `Zelt ${Math.round(layout.widthCm)} cm` });
  dims.push({ x1: -60, y1: 0, x2: -60, y2: layout.heightCm, label: `Zelt ${Math.round(layout.heightCm)} cm` });
  if (rows[0]) dims.push({ x1: rows[0].x, y1: rows[0].y + rows[0].h + 50, x2: rows[0].x + rows[0].w, y2: rows[0].y + rows[0].h + 50, label: `Reihe ${Math.round(rows[0].w)} cm` });
  const t0 = planTables(layout)[0];
  if (t0) dims.push({ x1: t0.x, y1: t0.y - 40, x2: t0.x + t0.w, y2: t0.y - 40, label: `Garnitur ${Math.round(t0.w)} × ${Math.round(t0.h)} cm` });
  const stages = layout.elements.filter(el => el.kind === 'stage');
  for (const s of stages) {
    if (s.kind !== 'stage' || rows.length === 0) continue;
    const below = rows.filter(r => r.y >= s.y + s.h).sort((a, b) => a.y - b.y)[0];
    if (below) dims.push({ x1: s.x + s.w + 80, y1: s.y + s.h, x2: s.x + s.w + 80, y2: below.y, label: `${Math.round(below.y - (s.y + s.h))} cm` });
  }
  const boundary = layout.elements.find(el => el.kind === 'boundary');
  const tables = planTables(layout);
  if (boundary && boundary.kind === 'boundary' && tables.length > 0) {
    const minX = Math.min(...tables.map(t => t.x)), minY = Math.min(...tables.map(t => t.y));
    const maxX = Math.max(...tables.map(t => t.x + t.w)), maxY = Math.max(...tables.map(t => t.y + t.h));
    if (minX > boundary.x) dims.push({ x1: boundary.x, y1: minY - 60, x2: minX, y2: minY - 60, label: `${Math.round(minX - boundary.x)} cm` });
    if (maxX < boundary.x + boundary.w) dims.push({ x1: maxX, y1: minY - 60, x2: boundary.x + boundary.w, y2: minY - 60, label: `${Math.round(boundary.x + boundary.w - maxX)} cm` });
    if (minY > boundary.y) dims.push({ x1: minX - 60, y1: boundary.y, x2: minX - 60, y2: minY, label: `${Math.round(minY - boundary.y)} cm` });
    if (maxY < boundary.y + boundary.h) dims.push({ x1: minX - 60, y1: maxY, x2: minX - 60, y2: boundary.y + boundary.h, label: `${Math.round(boundary.y + boundary.h - maxY)} cm` });
  }
  // Aufbau-Maßketten: jede Reihe ab Zeltkante positionieren, Reihenlänge,
  // Doppelreihen-Innenabstand, Tür-Positionen + Breiten, Bereichsmaße.
  if (boundary && boundary.kind === 'boundary') {
    for (const r of rows) {
      const vert = rowStackVertical(r);
      const from = vert ? boundary.x : boundary.y;
      const start = vert ? r.x : r.y;
      const offset = start - from;
      if (offset > 0) {
        dims.push(vert
          ? { x1: from, y1: r.y - 45, x2: start, y2: r.y - 45, label: `${r.label} ${Math.round(offset)} cm` }
          : { x1: r.x - 45, y1: from, x2: r.x - 45, y2: start, label: `${r.label} ${Math.round(offset)} cm` });
      }
      const len = vert ? r.h : r.w;
      dims.push(vert
        ? { x1: r.x + r.w + 45, y1: r.y, x2: r.x + r.w + 45, y2: r.y + r.h, label: `${Math.round(len)} cm` }
        : { x1: r.x, y1: r.y + r.h + 45, x2: r.x + r.w, y2: r.y + r.h + 45, label: `${Math.round(len)} cm` });
      if (r.spacing?.double && r.spacing.gapInner > 0) {
        dims.push(vert
          ? { x1: r.x - 90, y1: r.y, x2: r.x - 90, y2: r.y + r.spacing.gapInner, label: `innen ${Math.round(r.spacing.gapInner)} cm` }
          : { x1: r.x, y1: r.y - 90, x2: r.x + r.spacing.gapInner, y2: r.y - 90, label: `innen ${Math.round(r.spacing.gapInner)} cm` });
      }
    }
    for (const d of layout.elements) {
      if (d.kind !== 'door') continue;
      const width = d.vertical ? d.h : d.w;
      const pos = d.vertical ? d.y - boundary.y : d.x - boundary.x;
      dims.push(d.vertical
        ? { x1: d.x - 60, y1: d.y, x2: d.x - 60, y2: d.y + d.h, label: `${Math.round(width)} cm` }
        : { x1: d.x, y1: d.y - 60, x2: d.x + d.w, y2: d.y - 60, label: `${Math.round(width)} cm` });
      if (pos > 0) {
        dims.push(d.vertical
          ? { x1: d.x + d.w + 60, y1: boundary.y, x2: d.x + d.w + 60, y2: d.y, label: `ab Ecke ${Math.round(pos)} cm` }
          : { x1: boundary.x, y1: d.y + d.h + 60, x2: d.x, y2: d.y + d.h + 60, label: `ab Ecke ${Math.round(pos)} cm` });
      }
    }
  }
  for (const a of layout.elements) {
    if (a.kind !== 'area') continue;
    dims.push({ x1: a.x, y1: a.y + a.h + 30, x2: a.x + a.w, y2: a.y + a.h + 30, label: `${a.label || 'Bereich'} ${Math.round(a.w)} cm` });
    dims.push({ x1: a.x + a.w + 30, y1: a.y, x2: a.x + a.w + 30, y2: a.y + a.h, label: `${Math.round(a.h)} cm` });
  }
  return dims;
}

export interface MeasureReport {
  aisles: { label: string; cm: number }[];
  stageDistance: number | null;
  wallMargins: { label: string; cm: number }[];
  violations: string[];
}

export function computeMeasureReport(layout: PlanLayout, mins: { aisle: number; stage: number; wall: number; maxRowSeats: number }): MeasureReport {
  const aisles: { label: string; cm: number }[] = [];
  const rows = [...planRows(layout)].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    const gap = !rowStackVertical(a) ? b.y - (a.y + a.h) : b.x - (a.x + a.w);
    if (gap > 0) aisles.push({ label: `${a.label} → ${b.label}`, cm: Math.round(gap) });
  }
  for (const r of rows) {
    if (r.spacing?.double) aisles.push({ label: `${r.label} (Doppelreihe innen)`, cm: Math.round(r.spacing.gapInner) });
  }
  const tables = planTables(layout);
  const stages = layout.elements.filter(el => el.kind === 'stage');
  let stageDistance: number | null = null;
  for (const s of stages) {
    for (const t of tables) {
      const dx = Math.max(0, s.x - (t.x + t.w), t.x - (s.x + s.w));
      const dy = Math.max(0, s.y - (t.y + t.h), t.y - (s.y + s.h));
      const d = Math.round(Math.hypot(dx, dy));
      if (stageDistance === null || d < stageDistance) stageDistance = d;
    }
  }
  const wallMargins: { label: string; cm: number }[] = [];
  const boundary = layout.elements.find(el => el.kind === 'boundary');
  if (boundary && boundary.kind === 'boundary' && tables.length > 0) {
    const minX = Math.min(...tables.map(t => t.x)), minY = Math.min(...tables.map(t => t.y));
    const maxX = Math.max(...tables.map(t => t.x + t.w)), maxY = Math.max(...tables.map(t => t.y + t.h));
    wallMargins.push(
      { label: 'Wand links', cm: Math.round(minX - boundary.x) },
      { label: 'Wand rechts', cm: Math.round(boundary.x + boundary.w - maxX) },
      { label: 'Wand oben', cm: Math.round(minY - boundary.y) },
      { label: 'Wand unten', cm: Math.round(boundary.y + boundary.h - maxY) },
    );
  }
  const violations: string[] = [];
  // VStättVO: max. 20 Sitze je Reihe zwischen zwei Seitengängen (Bayern 10 je Seite).
  for (const r of rows) {
    const seats = tablesOfRow(layout, r.id).reduce((s, t) => s + t.capacity, 0);
    if (seats > mins.maxRowSeats) violations.push(`${r.label}: ${seats} Plätze > Max. ${mins.maxRowSeats} je Reihe (VStättVO)`);
  }
  for (const a of aisles) if (a.cm < mins.aisle) violations.push(`Gang ${a.label}: ${a.cm} cm < Mindestmaß ${mins.aisle} cm`);
  if (stageDistance !== null && stageDistance < mins.stage) violations.push(`Bühne → nächster Tisch: ${stageDistance} cm < Mindestmaß ${mins.stage} cm`);
  for (const w of wallMargins) if (w.cm < mins.wall) violations.push(`${w.label}: ${w.cm} cm < Mindestmaß ${mins.wall} cm`);
  return { aisles, stageDistance, wallMargins, violations };
}

export interface SnapLines { xs: number[]; ys: number[] }

export function snapCandidates(layout: PlanLayout, excludeIds: Set<string>): SnapLines {
  const xs: number[] = [0, layout.widthCm];
  const ys: number[] = [0, layout.heightCm];
  for (const el of layout.elements) {
    if (excludeIds.has(el.id) || el.kind === 'label') continue;
    xs.push(el.x, el.x + el.w / 2, el.x + el.w);
    ys.push(el.y, el.y + el.h / 2, el.y + el.h);
  }
  return { xs, ys };
}

export function snapValue(value: number, candidates: number[], threshold: number): { value: number; guide: number | null } {
  let best: number | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestDist) { best = c; bestDist = d; }
  }
  return best === null ? { value, guide: null } : { value: best, guide: best };
}

export function isLayout(value: unknown): value is PlanLayout {
  if (!value || typeof value !== 'object') return false;
  const l = value as PlanLayout;
  return l.version === 1 && Array.isArray(l.elements) && typeof l.widthCm === 'number' && typeof l.heightCm === 'number';
}