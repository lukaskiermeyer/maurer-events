"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";
import { PlanCanvas, PlanStaticSvg, type DrawPreset, type PlanTool } from "@/components/admin/plan/PlanCanvas";
import NumField from "@/components/admin/plan/NumField";
import { savePlanPreset, deletePlanPreset, duplicatePlanPreset, getPlanPresets } from "@/app/actions/plans";
import {
  AREA_COLORS, DEFAULT_LAYOUT, DEFAULT_NUMBERING, DEFAULT_ROW_SPEC, DIM_CATEGORIES, DOOR_WIDTHS, applyNumbering, childrenOf, computeDimensions, computeMeasureReport, descendantIds, isLayout,
  garniturFootprint, highestGroupAt, isAncestorOf, measurementDistance, moveGroup, parentOf, planRows, planTables, rowBlockGeometry, sortedRows, tableLabel, tablesOfRow,
  type DimCategory, type MeasurementMode, type NumberingOptions, type NumberingScheme, type PlanElement, type PlanLayout, type PlanMeasurement, type PlanTable, type RowSpec,
} from "@/lib/plan-types";
import type { PlanPresetRecord } from "@/types/domain";

type Rect = { x: number; y: number; w: number; h: number };
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Zelt & Bereiche' },
  { step: 2, label: 'Bühne & Marker' },
  { step: 3, label: 'Reihen & Tische' },
  { step: 4, label: 'Maße' },
  { step: 5, label: 'Nummerierung' },
  { step: 6, label: 'Prüfen & Speichern' },
  { step: 7, label: 'Bearbeiten' },
];

const SCHEMES: { key: NumberingScheme; label: string; desc: string; example: string }[] = [
  { key: 'continuous', label: 'Fortlaufend (Bierzelt)', desc: 'Eine Nummer über den ganzen Plan in Leserichtung', example: 'T001, T002 …' },
  { key: 'zones', label: 'Nummernkreise je Bereich (Vereinsfest)', desc: 'Eigener Hunderter-Block pro Bereich bzw. Zelt', example: 'Zelt 101…, Biergarten 201…' },
  { key: 'rowTable', label: 'Reihe.Tisch (Koordinaten)', desc: 'Reihennummer + Tisch innerhalb der Reihe', example: '1.01, 1.02, 2.01 …' },
  { key: 'oddEven', label: 'Gerade/Ungerade ab Mittelgang (Theater)', desc: 'Ungerade links, gerade rechts, von der Mitte nach außen', example: '1.01 links, 1.02 rechts …' },
];

const EDIT_TOOLS: { key: PlanTool; label: string }[] = [
  { key: "select", label: "Auswählen" },
  { key: "pan", label: "Hand" },
  { key: "area", label: "Bereich" },
  { key: "boundary", label: "Zeltgrenze" },
  { key: "stage", label: "Bühne" },
  { key: "wall", label: "Wand" },
  { key: "door", label: "Tür" },
  { key: "table", label: "Tisch" },
  { key: "label", label: "Text" },
  { key: "measure", label: "Messen" },
];

const DIM_PRESETS: { label: string; keys: DimCategory[] }[] = [
  { label: "Aufbau", keys: ["zelt", "gaenge", "reihen-position", "reihen-laenge", "wand", "tueren", "buehne"] },
  { label: "Zelt & Gänge", keys: ["zelt", "gaenge"] },
  { label: "Alle", keys: DIM_CATEGORIES.map(c => c.key) },
  { label: "Keine Auto-Maße", keys: [] },
];

export default function PlanManager({ presets: initialPresets, initialPresetId }: { presets: PlanPresetRecord[]; initialPresetId: string | null }) {
  const toast = useToast();
  const dialog = useDialog();
  const [presets, setPresets] = useState(initialPresets);
  const initial = initialPresets.find(p => p.id === initialPresetId) ?? initialPresets[0] ?? null;
  const [currentId, setCurrentId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "Neuer Plan");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [layout, setLayout] = useState<PlanLayout>(initial ? structuredClone(initial.layout) : structuredClone(DEFAULT_LAYOUT));
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState<Step>(initial && initial.layout.elements.length > 0 ? 6 : 1);
  const [tool, setTool] = useState<PlanTool>("select");
  const [drawPreset, setDrawPreset] = useState<DrawPreset | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowSpec, setRowSpec] = useState<RowSpec>({ ...DEFAULT_ROW_SPEC });
  const [numbering, setNumbering] = useState<NumberingOptions>({ ...DEFAULT_NUMBERING });
  const [showDims, setShowDims] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasurementMode>("axis");
  const [placeX, setPlaceX] = useState(0);
  const [placeY, setPlaceY] = useState(0);
  const [refId, setRefId] = useState("");
  const [refAxis, setRefAxis] = useState<"vertical" | "horizontal">("vertical");
  const [refGap, setRefGap] = useState(250);
  const [mins, setMins] = useState({ aisle: 80, stage: 100, wall: 50, maxRowSeats: 20 });
  const measurements: PlanMeasurement[] = layout.measurements ?? [];
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null);
  const [constantsOpen, setConstantsOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [doorWidth, setDoorWidth] = useState(220);
  const [doorLabel, setDoorLabel] = useState("Tür 220cm");
  const [history, setHistory] = useState<PlanLayout[]>([]);
  const [future, setFuture] = useState<PlanLayout[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const moveStartedRef = useRef(false);

  const selected = useMemo(() => selectedIds.length === 1 ? layout.elements.find(el => el.id === selectedIds[0]) ?? null : null, [layout, selectedIds]);
  const selectionRoots = (ids: string[]) => ids.filter(id => !ids.some(o => o !== id && isAncestorOf(layout, o, id)));
  const areas = useMemo(() => layout.elements.filter(el => el.kind === 'area'), [layout]);
  const tent = useMemo(() => layout.elements.find(el => el.kind === 'boundary') ?? null, [layout]);
  const rows = useMemo(() => planRows(layout), [layout]);
  const tables = useMemo(() => planTables(layout), [layout]);

  const breadcrumb = useMemo(() => {
    const path: PlanElement[] = [];
    let cur = selected;
    while (cur) {
      path.unshift(cur);
      const pid = parentOf(layout, cur.id);
      cur = pid ? layout.elements.find(el => el.id === pid) ?? null : null;
    }
    return path;
  }, [layout, selected]);

  const pushHistory = (snapshot: PlanLayout) => {
    setHistory(h => [...h.slice(-59), snapshot]);
    setFuture([]);
  };
  const commit = (fn: (l: PlanLayout) => PlanLayout) => {
    pushHistory(layout);
    setLayout(l => fn(l));
    setDirty(true);
  };
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture([...future, layout]);
    setLayout(prev);
    setSelectedMeasure(null);
    setDirty(true);
  };
  const redo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setHistory([...history, layout]);
    setLayout(next);
    setSelectedMeasure(null);
    setDirty(true);
  };

  const loadPreset = (p: PlanPresetRecord | null) => {
    setCurrentId(p?.id ?? null);
    setName(p?.name ?? "Neuer Plan");
    setDescription(p?.description ?? "");
    setLayout(p ? structuredClone(p.layout) : structuredClone(DEFAULT_LAYOUT));
    setNumbering(p?.layout.numbering ? { ...p.layout.numbering } : { ...DEFAULT_NUMBERING });
    setSelectedIds([]);
    setSelectedMeasure(null);
    setHistory([]);
    setFuture([]);
    setStep(p && p.layout.elements.length > 0 ? 7 : 1);
    setTool("select");
    setDirty(false);
    setSaveState("idle");
    setSavedAt(null);
  };

  const guardDirty = async () => !dirty || await dialog.confirm({ title: "Ungespeicherte Änderungen", message: "Der aktuelle Plan wurde noch nicht gespeichert. Änderungen verwerfen?", confirmLabel: "Verwerfen", danger: true });

  const selectPreset = async (id: string) => {
    if (id === currentId) return;
    if (!await guardDirty()) return;
    loadPreset(presets.find(p => p.id === id) ?? null);
  };
  const newPreset = async () => {
    if (!await guardDirty()) return;
    loadPreset(null);
  };

  const doSave = async (silent: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const { id } = await savePlanPreset({ id: currentId, name, description, layout });
      setCurrentId(id);
      setDirty(false);
      setPresets(await getPlanPresets());
      setSaveState("saved");
      setSavedAt(new Date());
      if (!silent) toast.showToast("Plan gespeichert.", "success");
    } catch (e) {
      setSaveState("error");
      toast.showToast(e instanceof Error ? e.message : "Speichern fehlgeschlagen.", "error");
    } finally { savingRef.current = false; }
  };
  const save = () => doSave(false);

  // Autosave: 1,5 s nach der letzten Änderung still speichern; bei laufenden
  // Saves wird der nächste Versuch erst danach geplant (dirty bleibt true).
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => { if (dirtyRef.current) void doSave(true); }, 1500);
    return () => window.clearTimeout(t);
  });

  const remove = async () => {
    if (!currentId) return;
    if (!await dialog.confirm({ title: "Plan löschen", message: `„${name}“ wirklich löschen? Events, die ihn nutzen, müssen erst umgestellt werden.`, confirmLabel: "Löschen", danger: true })) return;
    try {
      await deletePlanPreset(currentId);
      setPresets(await getPlanPresets());
      loadPreset(null);
      toast.showToast("Plan gelöscht.", "success");
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Löschen fehlgeschlagen.", "error"); }
  };

  const duplicate = async () => {
    if (!currentId) return;
    try {
      const { id } = await duplicatePlanPreset(currentId);
      const fresh = await getPlanPresets();
      setPresets(fresh);
      loadPreset(fresh.find(p => p.id === id) ?? null);
      toast.showToast("Plan dupliziert.", "success");
    } catch (e) { toast.showToast(e instanceof Error ? e.message : "Duplizieren fehlgeschlagen.", "error"); }
  };

  const defaultToolForStep = (s: Step): PlanTool => s === 1 ? "area" : s === 2 ? "stage" : s === 3 ? "row" : "select";

  const gotoStep = (s: Step) => {
    setStep(s);
    setSelectedIds([]);
    setSelectedMeasure(null);
    setDrawPreset(null);
    setTool(defaultToolForStep(s));
    if (s === 4) setShowDims(true);
  };

  // Zeltgrenze folgt immer den Zeltmaßen: existiert sie nicht, wird sie angelegt.
  // Strukturelle Auto-Sync, kein Nutzer-Edit: setzt weder dirty noch History.
  const ensureBoundary = () => {
    if (layout.elements.some(el => el.kind === 'boundary')) return;
    setLayout(l => ({ ...l, elements: [...l.elements, { kind: 'boundary', id: crypto.randomUUID(), x: 0, y: 0, w: l.widthCm, h: l.heightCm, label: 'Zelt' }] }));
  };

  useEffect(() => {
    if (step === 1) ensureBoundary();
  });

  const setTentSize = (axis: "widthCm" | "heightCm", n: number) => {
    commit(l => {
      const next = { ...l, [axis]: n };
      const has = next.elements.some(el => el.kind === 'boundary');
      const elements = has
        ? next.elements.map(el => el.kind === 'boundary' ? { ...el, x: 0, y: 0, w: next.widthCm, h: next.heightCm } : el)
        : [...next.elements, { kind: 'boundary', id: crypto.randomUUID(), x: 0, y: 0, w: next.widthCm, h: next.heightCm, label: 'Zelt' } as PlanElement];
      return { ...next, elements };
    });
  };

  // Hand-Icon im Plan: in jedem Step kurz die Ansicht verschieben, danach zurück zum Step-Werkzeug.
  const togglePan = () => setTool(t => t === "pan" ? defaultToolForStep(step) : "pan");
  const toggleSelect = () => setTool(t => t === "select" ? defaultToolForStep(step) : "select");

  // Eigene Maße gehören zum Plan-Dokument: Autosave, Export, Undo und Druck
  // verwenden dadurch denselben Stand wie alle anderen Plan-Elemente.
  const changeMeasurements = (fn: (items: PlanMeasurement[]) => PlanMeasurement[]) =>
    commit(l => ({ ...l, measurements: fn(l.measurements ?? []) }));
  const addMeasurement = (m: PlanMeasurement) => {
    if (measurements.length >= 500) { toast.showToast("Maximal 500 eigene Maße pro Plan.", "warning"); return; }
    changeMeasurements(items => [...items, m]);
    setSelectedMeasure(measurements.length);
    setSelectedIds([]);
  };
  const patchMeasurement = (i: number, patch: Partial<Omit<PlanMeasurement, "id">>) =>
    changeMeasurements(items => items.map((m, j) => j === i ? { ...m, ...patch } : m));
  const deleteMeasurement = (i: number) => {
    changeMeasurements(items => items.filter((_, j) => j !== i));
    setSelectedMeasure(null);
  };
  const clearMeasurements = () => {
    changeMeasurements(() => []);
    setSelectedMeasure(null);
  };

  // Optional: Element unter Punkt B gezielt verschieben, bis der Abstand stimmt.
  const adjustMeasurement = (i: number, axis: "x" | "y", target: number) => {
    const m = measurements[i];
    if (!m) return;
    const current = axis === "x" ? m.b.x - m.a.x : m.b.y - m.a.y;
    const delta = target - current;
    if (delta === 0) return;
    const id = highestGroupAt(layout, m.b.x, m.b.y);
    if (!id) { toast.showToast("Unter Punkt B liegt kein Element – Abstand kann nicht angepasst werden.", "warning"); return; }
    commit(l => {
      const moved = moveGroup(l, id, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
      return { ...moved, measurements: (moved.measurements ?? []).map((mm, j) => j === i ? { ...mm, b: { x: mm.b.x + (axis === "x" ? delta : 0), y: mm.b.y + (axis === "y" ? delta : 0) } } : mm) };
    });
  };

  const containingAreaId = (x: number, y: number): string | undefined => {
    for (let i = areas.length - 1; i >= 0; i--) {
      const a = areas[i];
      if (a.kind === 'area' && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a.id;
    }
    // Innerhalb der Zeltgrenze, aber in keinem eigenen Bereich: gehört zum Zelt.
    if (tent && x >= tent.x && x <= tent.x + tent.w && y >= tent.y && y <= tent.y + tent.h) return tent.id;
    return undefined;
  };

  const createRect = (kind: "area" | "boundary" | "stage" | "wall", rect: Rect, preset?: DrawPreset | null) => {
    const id = crypto.randomUUID();
    const el: PlanElement = kind === "area"
      ? { kind, id, ...rect, label: preset?.label ?? "Bereich", color: preset?.color ?? AREA_COLORS[0] }
      : kind === "stage"
        ? { kind, id, ...rect, label: preset?.label ?? "Bühne" }
        : kind === "wall"
          ? { kind, id, ...rect }
          : { kind, id, ...rect, label: preset?.label ?? "Zelt" };
    commit(l => ({ ...l, elements: [...l.elements, el] }));
    setSelectedIds([id]);
  };

  const createDoor = (rect: Rect, wallId: string, vertical: boolean) => {
    const id = crypto.randomUUID();
    commit(l => ({ ...l, elements: [...l.elements, { kind: "door", id, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h), label: doorLabel, wallId, vertical }] }));
    setSelectedIds([id]);
    toast.showToast(`${doorLabel} in Wand gesetzt.`, "success");
  };

  const createTable = (point: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const foot = garniturFootprint(220, 50, 25, 10, false);
    commit(l => ({
      ...l,
      nextNumber: l.nextNumber + 1,
      elements: [...l.elements, { kind: "table", id, x: Math.round(point.x - foot.w / 2), y: Math.round(point.y - foot.h / 2), w: foot.w, h: foot.h, number: l.nextNumber, capacity: 8, shape: "rect", benchDepth: 25, benchGap: 10, areaId: containingAreaId(point.x, point.y) }],
    }));
    setSelectedIds([id]);
  };

  const placeRow = (point: { x: number; y: number }) => {
    const geo = rowBlockGeometry(rowSpec, point.x, point.y);
    const rowId = crypto.randomUUID();
    const areaId = rowSpec.areaId ?? containingAreaId(point.x, point.y);
    commit(l => {
      const label = `Reihe ${planRows(l).length + 1}`;
      const elements: PlanElement[] = [...l.elements, { kind: "row", id: rowId, x: Math.round(point.x), y: Math.round(point.y), w: Math.round(geo.w), h: Math.round(geo.h), rotation: rowSpec.tableVertical ? 90 : 0, stackVertical: rowSpec.stackVertical, label, areaId, spacing: { gapTables: rowSpec.gapTables, gapRows: rowSpec.gapRows, gapInner: rowSpec.gapInner, double: rowSpec.double } }];
      let number = l.nextNumber;
      for (const c of geo.cells) {
        elements.push({ kind: "table", id: crypto.randomUUID(), x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), number, capacity: rowSpec.capacity, shape: rowSpec.shape, rowId, areaId, vertical: rowSpec.tableVertical, benchDepth: rowSpec.benchDepth, benchGap: rowSpec.benchGap });
        number++;
      }
      return { ...l, elements, nextNumber: number };
    });
    toast.showToast(`Reihe mit ${rowSpec.tablesPerRow * rowSpec.rowCount} Tischen eingesetzt.`, "success");
  };

  const createLabel = async (point: { x: number; y: number }) => {
    const text = await dialog.prompt({ title: "Beschriftung", message: "Text für die Beschriftung (z. B. Reihe 1, Haupteingang):", confirmLabel: "Platzieren" });
    if (!text?.trim()) return;
    const id = crypto.randomUUID();
    commit(l => ({ ...l, elements: [...l.elements, { kind: "label", id, x: Math.round(point.x), y: Math.round(point.y), text: text.trim() }] }));
    setSelectedIds([id]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectionRoots(selectedIds).flatMap(id => [id, ...descendantIds(layout, id)]));
    commit(l => ({ ...l, elements: l.elements.filter(el => !ids.has(el.id)) }));
    setSelectedIds([]);
    toast.showToast(`${ids.size} Element${ids.size === 1 ? "" : "e"} gelöscht.`, "success");
  };

  const duplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const roots = selectionRoots(selectedIds);
    commit(l => {
      const idMap = new Map<string, string>();
      const clones: PlanElement[] = [];
      const collect = (id: string) => {
        const el = l.elements.find(e => e.id === id);
        if (!el) return;
        const nid = crypto.randomUUID();
        idMap.set(id, nid);
        for (const child of childrenOf(l, id)) collect(child.id);
        clones.push({ ...el, id: nid, x: el.x + 60, y: el.y + 60 } as PlanElement);
      };
      roots.forEach(collect);
      const remapped = clones.map(el => {
        const next = { ...el } as Record<string, unknown>;
        if (next.rowId) next.rowId = idMap.get(String(next.rowId)) ?? null;
        if (next.areaId && idMap.has(String(next.areaId))) next.areaId = idMap.get(String(next.areaId));
        if (next.wallId && idMap.has(String(next.wallId))) next.wallId = idMap.get(String(next.wallId));
        return next as unknown as PlanElement;
      });
      return { ...l, elements: [...l.elements, ...remapped] };
    });
    toast.showToast("Auswahl dupliziert (+60 cm Versatz).", "success");
  };

  const bboxOf = (l: PlanLayout, id: string) => {
    const ids = [id, ...descendantIds(l, id)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cid of ids) {
      const el = l.elements.find(e => e.id === cid);
      if (!el || el.kind === "label") continue;
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.w); maxY = Math.max(maxY, el.y + el.h);
    }
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  };

  const alignSelected = (mode: "left" | "right" | "top" | "bottom" | "cx" | "cy") => {
    const roots = selectionRoots(selectedIds);
    if (roots.length < 2) return;
    commit(l => {
      const boxes = roots.map(id => ({ id, b: bboxOf(l, id) }));
      const target = mode === "left" ? Math.min(...boxes.map(x => x.b.minX))
        : mode === "right" ? Math.max(...boxes.map(x => x.b.maxX))
        : mode === "top" ? Math.min(...boxes.map(x => x.b.minY))
        : mode === "bottom" ? Math.max(...boxes.map(x => x.b.maxY))
        : mode === "cx" ? boxes.reduce((s, x) => s + x.b.cx, 0) / boxes.length
        : boxes.reduce((s, x) => s + x.b.cy, 0) / boxes.length;
      let next = l;
      for (const { id, b } of boxes) {
        const dx = mode === "left" ? target - b.minX : mode === "right" ? target - b.maxX : mode === "cx" ? target - b.cx : 0;
        const dy = mode === "top" ? target - b.minY : mode === "bottom" ? target - b.maxY : mode === "cy" ? target - b.cy : 0;
        next = moveGroup(next, id, Math.round(dx), Math.round(dy));
      }
      return next;
    });
  };

  const distributeSelected = (axis: "x" | "y") => {
    const roots = selectionRoots(selectedIds);
    if (roots.length < 3) return;
    commit(l => {
      const boxes = roots.map(id => ({ id, b: bboxOf(l, id) })).sort((a, z) => axis === "x" ? a.b.cx - z.b.cx : a.b.cy - z.b.cy);
      const first = boxes[0].b, last = boxes[boxes.length - 1].b;
      const span = axis === "x" ? last.cx - first.cx : last.cy - first.cy;
      const stepGap = span / (boxes.length - 1);
      let next = l;
      boxes.forEach((x, i) => {
        const target = (axis === "x" ? first.cx : first.cy) + stepGap * i;
        const cur = axis === "x" ? x.b.cx : x.b.cy;
        next = moveGroup(next, x.id, axis === "x" ? Math.round(target - cur) : 0, axis === "y" ? Math.round(target - cur) : 0);
      });
      return next;
    });
  };

  const exportPreset = () => {
    const blob = new Blob([JSON.stringify({ name, description, layout }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\wäöüÄÖÜ-]+/g, "_") || "tischplan"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { name?: string; description?: string | null; layout?: unknown };
      if (!parsed.layout || !isLayout(parsed.layout)) { toast.showToast("Ungültige Plan-Datei.", "error"); return; }
      loadPreset(null);
      setName(parsed.name ? `${parsed.name} (Import)` : "Importierter Plan");
      setDescription(parsed.description ?? "");
      setLayout(parsed.layout);
      setDirty(true);
      toast.showToast("Plan importiert – bitte prüfen und speichern.", "success");
    } catch {
      toast.showToast("Datei konnte nicht gelesen werden.", "error");
    }
  };

  const patchElement = (id: string, patch: Record<string, unknown>) =>
    commit(l => ({ ...l, elements: l.elements.map(el => el.id === id ? ({ ...el, ...patch } as PlanElement) : el) }));

  // Garnitur-Maße: Platte + Bänke + Abstände ergeben das Gesamtmaß (w/h).
  const patchTable = (t: PlanTable, p: { plateW?: number; plateH?: number; benchDepth?: number; benchGap?: number }) => {
    const bd = p.benchDepth ?? t.benchDepth ?? 0;
    const bg = p.benchGap ?? t.benchGap ?? 0;
    const oldInset = (t.benchDepth ?? 0) + (t.benchGap ?? 0);
    const pw = p.plateW ?? (t.vertical ? t.h : t.w);
    const ph = p.plateH ?? ((t.vertical ? t.w : t.h) - 2 * oldInset);
    const foot = garniturFootprint(pw, ph, bd, bg, !!t.vertical);
    patchElement(t.id, { w: foot.w, h: foot.h, benchDepth: bd, benchGap: bg });
  };

  // Position numerisch setzen: Gruppen nehmen ihren Inhalt mit.
  const setPosition = (id: string, axis: "x" | "y", value: number) => {
    const el = layout.elements.find(e => e.id === id);
    if (!el) return;
    const delta = value - el[axis];
    if (delta === 0) return;
    commit(l => moveGroup(l, id, axis === "x" ? delta : 0, axis === "y" ? delta : 0));
  };

  const placeAtReference = () => {
    const ref = layout.elements.find(e => e.id === refId);
    if (!ref || ref.kind === 'label' || ref.kind === 'table') return;
    const origin = refAxis === "vertical"
      ? { x: ref.x, y: ref.y + ref.h + refGap }
      : { x: ref.x + ref.w + refGap, y: ref.y };
    placeRow(origin);
  };

  const report = useMemo(() => computeMeasureReport(layout, mins), [layout, mins]);
  const activeDims = layout.printDims ?? DIM_CATEGORIES.map(c => c.key);
  const allDimensions = useMemo(() => computeDimensions({ ...layout, printDims: undefined }), [layout]);
  const dimensionCount = (key: DimCategory) => allDimensions.filter(d => d.cat === key).length;
  const setPrintDims = (keys: DimCategory[]) => {
    commit(l => ({ ...l, printDims: keys }));
    setShowDims(true);
  };
  const togglePrintDim = (key: DimCategory) => commit(l => {
    const current = l.printDims ?? DIM_CATEGORIES.map(c => c.key);
    return { ...l, printDims: current.includes(key) ? current.filter(k => k !== key) : [...current, key] };
  });
  const zoneGroups = useMemo(() => {
    const ids = [...new Set(tables.map(t => t.areaId ?? 'frei'))];
    return ids.map((id, idx) => {
      const el = layout.elements.find(e => e.id === id);
      const label = id === 'frei' ? 'Ohne Bereich' : el && el.kind === 'boundary' ? (el.label || 'Zelt') : el && el.kind === 'area' ? (el.label || 'Bereich') : 'Bereich';
      return { id, label, auto: (idx + 1) * 100 };
    });
  }, [tables, layout]);
  const stepDone = (s: Step): boolean =>
    s === 1 ? (!!tent || areas.length > 0)
    : s === 2 ? layout.elements.some(el => el.kind === 'stage' || el.kind === 'door' || el.kind === 'wall')
    : s === 3 ? rows.length > 0
    : s === 4 ? true
    : s === 5 ? !!layout.numbering
    : s === 6 ? summary.overlaps === 0 && summary.outside === 0
    : false;
  const preview = useMemo(() => applyNumbering(layout, numbering), [layout, numbering]);
  const previewLabels = useMemo(() => planTables(preview).slice(0, 6).map(t => tableLabel(preview, t)), [preview]);
  const previewRows = useMemo(() => sortedRows(preview, numbering).slice(0, 4).map(r => r.label), [preview, numbering]);
  const refOptions = useMemo(() => layout.elements.filter(el => el.kind === 'stage' || el.kind === 'row' || el.kind === 'boundary'), [layout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === "Escape") {
        if (selectedMeasure !== null) { setSelectedMeasure(null); return; }
        if (selectedIds.length > 1) setSelectedIds([]);
        else if (selectedIds.length === 1) setSelectedIds(parentOf(layout, selectedIds[0]) ? [parentOf(layout, selectedIds[0])!] : []);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedMeasure !== null) {
        e.preventDefault();
        deleteMeasurement(selectedMeasure);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) { e.preventDefault(); deleteSelected(); return; }
      if (selectedIds.length > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const d = e.shiftKey ? 50 : 10;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        const roots = selectionRoots(selectedIds);
        commit(l => roots.reduce((acc, id) => moveGroup(acc, id, dx, dy), l));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const summary = useMemo(() => {
    const groups = [...(tent ? [tent] : []), ...areas.filter(a => a.kind === 'area')];
    const perArea = groups.map(a => {
      const ts = tables.filter(t => t.areaId === a.id);
      return { label: a.kind === 'boundary' ? (a.label || 'Zelt') : (a.label || 'Bereich'), tables: ts.length, seats: ts.reduce((s, t) => s + t.capacity, 0) };
    });
    const free = tables.filter(t => !t.areaId);
    const boundary = layout.elements.find(el => el.kind === 'boundary');
    const outside = boundary && boundary.kind === 'boundary'
      ? tables.filter(t => t.x < boundary.x || t.y < boundary.y || t.x + t.w > boundary.x + boundary.w || t.y + t.h > boundary.y + boundary.h).length
      : 0;
    let overlaps = 0;
    if (tables.length <= 600) {
      for (let i = 0; i < tables.length; i++) for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i], b = tables[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
      }
    }
    return { perArea, freeTables: free.length, freeSeats: free.reduce((s, t) => s + t.capacity, 0), outside, overlaps, totalSeats: tables.reduce((s, t) => s + t.capacity, 0) };
  }, [areas, tables, layout, tent]);

  const field = "mt-1 w-full rounded-lg border border-border-light p-2";
  const toolBtn = (active: boolean) => `min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors ${active ? "bg-accent-green text-white" : "bg-white border border-border-light hover:border-accent-green"}`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-display font-black text-base-dark">Tischpläne</h1>
        <div className="relative">
          <button type="button" onClick={() => setPresetOpen(v => !v)} aria-expanded={presetOpen} aria-label="Plan-Preset wählen" className="min-h-11 flex items-center gap-2 rounded-xl border border-border-light bg-white px-3 font-bold">
            <span className="max-w-40 truncate">{name || "Neuer Plan"}</span>
            <span aria-hidden className="text-xs opacity-60">▼</span>
          </button>
          {presetOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-96 w-80 overflow-y-auto rounded-xl border border-border-light bg-white p-2 shadow-xl">
              <button type="button" onClick={() => { setPresetOpen(false); void newPreset(); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-bold hover:bg-canvas-light">
                <span className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-border-light text-xs opacity-50">+</span>
                Neuer Plan
              </button>
              {presets.map(p => (
                <button key={p.id} type="button" onClick={() => { setPresetOpen(false); void selectPreset(p.id); }} className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-bold hover:bg-canvas-light ${p.id === currentId ? "bg-accent-green/10 text-accent-green" : ""}`}>
                  <span className="h-12 w-20 shrink-0 overflow-hidden rounded border border-border-light bg-white">
                    <PlanStaticSvg layout={p.layout} className="h-full w-full" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    <span className="block text-xs opacity-60">{planTables(p.layout).length} Tische · {planRows(p.layout).length} Reihen</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} maxLength={80} className="min-h-11 flex-1 min-w-40 rounded-xl border border-border-light bg-white px-3 font-bold" aria-label="Plan-Name" />
        <label className="min-h-11 inline-flex cursor-pointer items-center rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">
          Import
          <input type="file" accept="application/json,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void importPreset(f); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={exportPreset} className="min-h-11 rounded-xl border border-border-light bg-white px-4 font-bold hover:border-accent-green">Export</button>
        <button type="button" onClick={duplicate} disabled={!currentId} className="min-h-11 rounded-xl border border-border-light bg-white px-4 font-bold disabled:opacity-40">Duplizieren</button>
        <button type="button" onClick={remove} disabled={!currentId} className="min-h-11 rounded-xl border border-border-light bg-white px-4 font-bold text-red-600 disabled:opacity-40">Löschen</button>
        <button type="button" onClick={save} disabled={saveState === "saving"} className="min-h-11 rounded-xl bg-accent-green px-6 font-black text-white disabled:opacity-50">{saveState === "saving" ? "Speichert…" : dirty ? "Speichern *" : "Speichern"}</button>
        <span aria-live="polite" className="text-xs font-bold text-base-dark/60">
          {saveState === "saving" ? "Autosave läuft…" : saveState === "error" ? "Autosave fehlgeschlagen – bitte erneut speichern" : savedAt ? `Automatisch gespeichert ${savedAt.toLocaleTimeString("de-DE")}` : "Autosave aktiv"}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-border-light bg-white p-1" role="tablist" aria-label="Plan-Schritte">
        {STEPS.map(s => (
          <button key={s.step} type="button" role="tab" aria-selected={step === s.step} onClick={() => gotoStep(s.step)} className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-colors ${step === s.step ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}>
            {s.step === 7 ? s.label : `${s.step} · ${s.label}`}
            {stepDone(s.step) && step !== s.step ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 space-y-4 rounded-2xl border border-border-light bg-white p-4 lg:w-80">
          {step === 1 && (
            <>
              <h3 className="font-display font-bold">Zeltgröße & Bereiche</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setTool("area"); setDrawPreset(null); }} className={toolBtn(tool === "area")}>Bereich zeichnen</button>
              </div>
              <p className="text-xs text-base-dark/60">Zeltmaße stellst du im Step <strong>4 · Maße</strong> ein – die Zeltgrenze entsteht automatisch und folgt jeder Maßänderung. Hier nur Bereiche aufziehen (z. B. Biergarten, Schenke); Name und Farbe rechts. Kanten rasten ein – Alt hält Snap aus.</p>
              <div className="space-y-1">
                {areas.map(a => a.kind === 'area' && (
                  <button key={a.id} type="button" onClick={() => setSelectedIds([a.id])} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold ${selectedIds.includes(a.id) ? "bg-accent-green/10 text-accent-green" : "hover:bg-canvas-light"}`}>
                    <span className="h-3 w-3 rounded" style={{ background: a.color }} />{a.label || 'Bereich'}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="font-display font-bold">Bühne & Marker</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setTool("stage"); setDrawPreset(null); }} className={toolBtn(tool === "stage" && !drawPreset)}>Bühne</button>
                <button type="button" onClick={() => { setTool("area"); setDrawPreset({ label: "Technik", color: "#1A1A1A" }); }} className={toolBtn(!!drawPreset && drawPreset.label === "Technik")}>Technik</button>
                <button type="button" onClick={() => { setTool("door"); setDrawPreset(null); }} className={toolBtn(tool === "door")}>Tür</button>
                <button type="button" onClick={() => { setTool("area"); setDrawPreset({ label: "Fluchtweg", color: "#2ECC71" }); }} className={toolBtn(!!drawPreset && drawPreset.label === "Fluchtweg")}>Fluchtweg</button>
                <button type="button" onClick={() => { setTool("wall"); setDrawPreset(null); }} className={toolBtn(tool === "wall")}>Wand</button>
              </div>
              {tool === "door" && (
                <div className="rounded-xl border border-border-light p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Tür-Öffnung</p>
                  <div className="flex flex-wrap gap-2">
                    {DOOR_WIDTHS.map(w => (
                      <button key={w} type="button" onClick={() => { setDoorWidth(w); setDoorLabel(w === 500 ? "Haupteingang" : `Tür ${w}cm`); }} className={toolBtn(doorWidth === w)}>{w === 500 ? "500 (Haupteingang)" : `${w} cm`}</button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                    <label className="block">Breite (cm)
                      <NumField min={50} value={doorWidth} onCommit={n => { setDoorWidth(n); setDoorLabel(`Tür ${n}cm`); }} className={field} />
                    </label>
                    <label className="block">Beschriftung
                      <input value={doorLabel} onChange={e => setDoorLabel(e.target.value)} className={field} />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-base-dark/60">Die Tür rastet <strong>nur in Wände oder die Zeltgrenze</strong> ein (grüne Vorschau). Klick setzt die Öffnung; ohne Wand passiert nichts. Verschieben später nur entlang der Wand.</p>
                </div>
              )}
              <p className="text-xs text-base-dark/60">Fläche aufziehen, wo Bühne, Technik oder Fluchtwege liegen. Beschriftung und Farbe rechts anpassbar.</p>
            </>
          )}
          {step === 3 && (
            <>
              <h3 className="font-display font-bold">Reihen & Tische</h3>

              <div className="rounded-xl border border-border-light p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Variabel · 1 · Block-Aufbau</p>
                <label className="block text-sm font-bold">Bereich
                  <select value={rowSpec.areaId ?? ""} onChange={e => setRowSpec(s => ({ ...s, areaId: e.target.value || null }))} className={field}>
                    <option value="">Frei (ohne Bereich)</option>
                    {tent && <option value={tent.id}>{tent.label || 'Zelt'}</option>}
                    {areas.map(a => a.kind === 'area' && <option key={a.id} value={a.id}>{a.label || 'Bereich'}</option>)}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                  <label className="block">Tische pro Reihe
                    <NumField min={1} max={200} value={rowSpec.tablesPerRow} onCommit={n => setRowSpec(s => ({ ...s, tablesPerRow: n }))} className={field} />
                  </label>
                  <label className="block">Anzahl Reihen
                    <NumField min={1} max={100} value={rowSpec.rowCount} onCommit={n => setRowSpec(s => ({ ...s, rowCount: n }))} className={field} />
                  </label>
                  <label className="block">Tisch-Ausrichtung
                    <select value={rowSpec.tableVertical ? "v" : "h"} onChange={e => setRowSpec(s => ({ ...s, tableVertical: e.target.value === "v" }))} className={field}>
                      <option value="h">waagerecht (liegend)</option>
                      <option value="v">senkrecht (stehend)</option>
                    </select>
                  </label>
                  <label className="block">Anordnung in Reihe
                    <select value={rowSpec.stackVertical ? "v" : "h"} onChange={e => setRowSpec(s => ({ ...s, stackVertical: e.target.value === "v" }))} className={field}>
                      <option value="h">nebeneinander</option>
                      <option value="v">untereinander</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-border-light p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Variabel · 2 · Platzierung</p>
                <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                  <label className="block">X (cm)
                    <NumField value={placeX} onCommit={setPlaceX} className={field} />
                  </label>
                  <label className="block">Y (cm)
                    <NumField value={placeY} onCommit={setPlaceY} className={field} />
                  </label>
                </div>
                <button type="button" onClick={() => placeRow({ x: placeX, y: placeY })} className="mt-2 min-h-11 w-full rounded-xl bg-base-dark font-bold text-white">Bei Koordinate einsetzen</button>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                  <label className="block col-span-2">Referenz
                    <select value={refId} onChange={e => setRefId(e.target.value)} className={field}>
                      <option value="">– wählen –</option>
                      {refOptions.map(r => <option key={r.id} value={r.id}>{r.kind === 'stage' ? r.label || 'Bühne' : r.kind === 'row' ? r.label : r.label || 'Zeltgrenze'}</option>)}
                    </select>
                  </label>
                  <label className="block">Richtung
                    <select value={refAxis} onChange={e => setRefAxis(e.target.value as 'vertical' | 'horizontal')} className={field}>
                      <option value="vertical">darunter</option>
                      <option value="horizontal">rechts daneben</option>
                    </select>
                  </label>
                  <label className="block">Abstand (cm)
                    <NumField min={0} value={refGap} onCommit={setRefGap} className={field} />
                  </label>
                </div>
                <button type="button" onClick={placeAtReference} disabled={!refId} className="mt-2 min-h-11 w-full rounded-xl bg-base-dark font-bold text-white disabled:opacity-40">Mit Abstand zur Referenz einsetzen</button>
                <p className="mt-2 text-xs text-base-dark/60">Die Vorschau folgt der Maus und rastet ein. <strong>Klicken = einsetzen</strong>, Esc = abbrechen. Mehrere Bereiche nacheinander bebauen möglich.</p>
              </div>

              <div className="rounded-xl border border-border-light">
                <button type="button" onClick={() => setConstantsOpen(v => !v)} aria-expanded={constantsOpen} className="flex w-full items-center justify-between gap-2 p-3 text-left">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">Konstanten · gelten für alle Blöcke</span>
                  <span aria-hidden className="text-xs font-bold opacity-70">{constantsOpen ? "▲" : "▼"}</span>
                </button>
                <p className="px-3 pb-3 text-xs font-bold opacity-70">
                  {rowSpec.shape === 'rect' ? 'Biergarnitur' : 'Rundtisch'} · {rowSpec.capacity} Pers./Tisch · Maße im Step 4 · Maße
                </p>
                {constantsOpen && (
                  <div className="space-y-3 border-t border-border-light p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                      <label className="block">Form
                        <select value={rowSpec.shape} onChange={e => setRowSpec(s => ({ ...s, shape: e.target.value as 'rect' | 'round' }))} className={field}>
                          <option value="rect">Biergarnitur</option>
                          <option value="round">Rund</option>
                        </select>
                      </label>
                      <label className="block">Personen/Tisch
                        <NumField min={1} value={rowSpec.capacity} onCommit={n => setRowSpec(s => ({ ...s, capacity: n }))} className={field} />
                      </label>
                    </div>
                    <p className="text-xs opacity-60">Tisch-, Bank- und Gangmaße stellst du zentral im Step <strong>4 · Maße</strong> ein.</p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {rows.map(r => (
                  <button key={r.id} type="button" onClick={() => setSelectedIds([r.id])} className={`flex w-full justify-between rounded-lg px-2 py-1.5 text-left text-sm font-bold ${selectedIds.includes(r.id) ? "bg-accent-green/10 text-accent-green" : "hover:bg-canvas-light"}`}>
                    <span>{r.label}</span><span className="opacity-60">{tablesOfRow(layout, r.id).length} Tische</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div>
                <h3 className="font-display font-bold">Maße & Aufbauplan</h3>
                <p className="mt-1 text-xs text-base-dark/60">Auto-Maße auswählen oder einzelne Abstände direkt im Plan messen. Nur die gewünschten Maße kommen in den Druck.</p>
              </div>

              <section className="rounded-xl border border-border-light p-3" aria-labelledby="auto-dims-heading">
                <div className="flex items-center justify-between gap-2">
                  <p id="auto-dims-heading" className="text-xs font-bold uppercase tracking-widest opacity-60">Automatische Maßketten</p>
                  <span className="text-xs font-bold opacity-60">{activeDims.length} Kategorien</span>
                </div>
                <button type="button" aria-pressed={showDims} onClick={() => setShowDims(v => !v)} className={`mt-2 ${toolBtn(showDims)} w-full`}>
                  {showDims ? "Maßketten im Plan sichtbar" : "Maßketten im Plan anzeigen"}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-1" aria-label="Schnellauswahl automatische Maße">
                  {DIM_PRESETS.map(p => <button key={p.label} type="button" onClick={() => setPrintDims(p.keys)} className="min-h-10 rounded-lg border border-border-light bg-white px-2 text-xs font-bold hover:border-accent-green">{p.label}</button>)}
                </div>
                <div className="mt-3 space-y-1">
                  {DIM_CATEGORIES.map(c => (
                    <label key={c.key} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-bold hover:bg-canvas-light">
                      <input type="checkbox" checked={activeDims.includes(c.key)} onChange={() => togglePrintDim(c.key)} className="h-4 w-4 shrink-0 accent-accent-green" />
                      <span className="flex-1">{c.label}</span>
                      <span className="text-xs font-normal tabular-nums opacity-50">{dimensionCount(c.key)}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs opacity-60">Die Zahl rechts zeigt die aktuell erzeugten Maße. Die Auswahl steuert Vorschau und Aufbau-/Druckplan.</p>
              </section>

              <section className="rounded-xl border border-accent-green/40 bg-accent-green/5 p-3" aria-labelledby="manual-dims-heading">
                <div className="flex items-center justify-between gap-2">
                  <p id="manual-dims-heading" className="text-xs font-bold uppercase tracking-widest opacity-60">Eigene Maße</p>
                  <span className="text-xs font-bold opacity-60">{measurements.filter(m => m.print !== false).length} im Druck</span>
                </div>
                <button type="button" aria-pressed={tool === "measure"} onClick={() => { setTool(tool === "measure" ? "select" : "measure"); setSelectedIds([]); setSelectedMeasure(null); }} className={`mt-2 ${toolBtn(tool === "measure")} w-full`}>
                  {tool === "measure" ? "Messen beenden" : "+ Neues Maß aufnehmen"}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white p-1" role="group" aria-label="Messrichtung">
                  <button type="button" aria-pressed={measureMode === "axis"} onClick={() => setMeasureMode("axis")} className={`min-h-10 rounded-lg px-2 text-xs font-bold ${measureMode === "axis" ? "bg-base-dark text-white" : "hover:bg-canvas-light"}`}>H / V</button>
                  <button type="button" aria-pressed={measureMode === "free"} onClick={() => setMeasureMode("free")} className={`min-h-10 rounded-lg px-2 text-xs font-bold ${measureMode === "free" ? "bg-base-dark text-white" : "hover:bg-canvas-light"}`}>Frei</button>
                </div>
                <p className="mt-2 text-xs text-base-dark/70">H / V erzeugt automatisch saubere horizontale oder vertikale Maße wie auf dem alten Zeltplan. Bezeichnung und Druckausgabe verwaltest du rechts unter <strong>Eigene Maße</strong>.</p>
              </section>

              <div className="rounded-xl border border-border-light p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Zeltmaße</p>
                <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                  <label className="block">Breite (cm)
                    <NumField min={100} step={10} value={layout.widthCm} onCommit={n => setTentSize("widthCm", n)} className={field} />
                  </label>
                  <label className="block">Länge (cm)
                    <NumField min={100} step={10} value={layout.heightCm} onCommit={n => setTentSize("heightCm", n)} className={field} />
                  </label>
                </div>
                <p className="mt-2 text-xs opacity-60">Die Zeltgrenze folgt beiden Werten automatisch.</p>
              </div>

              <details className="rounded-xl border border-border-light p-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest opacity-60">Standardwerte für neue Reihen</summary>
                <p className="mt-2 text-xs text-base-dark/60">Diese Werte gelten für neu eingesetzte Blöcke. Bestehende Garnituren bearbeitest du über deren Eigenschaften.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                  <label className="block">Tischbreite (cm)
                    <NumField min={20} value={rowSpec.tableW} onCommit={n => setRowSpec(s => ({ ...s, tableW: n }))} className={field} />
                  </label>
                  <label className="block">Tischtiefe (cm)
                    <NumField min={20} value={rowSpec.tableH} onCommit={n => setRowSpec(s => ({ ...s, tableH: n }))} className={field} />
                  </label>
                  <label className="block">Banktiefe (cm)
                    <NumField min={0} value={rowSpec.benchDepth} onCommit={n => setRowSpec(s => ({ ...s, benchDepth: n }))} className={field} />
                  </label>
                  <label className="block">Bank–Tisch (cm)
                    <NumField min={0} value={rowSpec.benchGap} onCommit={n => setRowSpec(s => ({ ...s, benchGap: n }))} className={field} />
                  </label>
                  <label className="block">Tischabstand (cm)
                    <NumField min={0} value={rowSpec.gapTables} onCommit={n => setRowSpec(s => ({ ...s, gapTables: n }))} className={field} />
                  </label>
                  <label className="block">Reihenabstand (cm)
                    <NumField min={0} value={rowSpec.gapRows} onCommit={n => setRowSpec(s => ({ ...s, gapRows: n }))} className={field} />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={rowSpec.double} onChange={e => setRowSpec(s => ({ ...s, double: e.target.checked }))} className="h-4 w-4 accent-accent-green" />
                  Doppelreihen mit engem Innenabstand
                </label>
                {rowSpec.double && (
                  <label className="mt-2 block text-sm font-bold">Innenabstand im Paar (cm)
                    <NumField min={0} value={rowSpec.gapInner} onCommit={n => setRowSpec(s => ({ ...s, gapInner: n }))} className={field} />
                  </label>
                )}
                <p className="mt-2 rounded-lg bg-canvas-light p-2 text-xs opacity-80">
                  Gesamtmaß: {Math.round(garniturFootprint(rowSpec.tableW, rowSpec.tableH, rowSpec.benchDepth, rowSpec.benchGap, rowSpec.tableVertical).w)} × {Math.round(garniturFootprint(rowSpec.tableW, rowSpec.tableH, rowSpec.benchDepth, rowSpec.benchGap, rowSpec.tableVertical).h)} cm je Garnitur
                </p>
              </details>

              <details className="rounded-xl bg-canvas-light p-3" open={report.violations.length > 0}>
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest opacity-60">
                  Mindestmaße & Prüfbericht {report.violations.length > 0 ? `(${report.violations.length} Hinweise)` : ""}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                  <label className="block">Min. Gang
                    <NumField min={0} value={mins.aisle} onCommit={n => setMins(m => ({ ...m, aisle: n }))} className={field} />
                  </label>
                  <label className="block">Min. Bühne
                    <NumField min={0} value={mins.stage} onCommit={n => setMins(m => ({ ...m, stage: n }))} className={field} />
                  </label>
                  <label className="block">Min. Wand
                    <NumField min={0} value={mins.wall} onCommit={n => setMins(m => ({ ...m, wall: n }))} className={field} />
                  </label>
                  <label className="block">Max. Plätze/Reihe
                    <NumField min={1} value={mins.maxRowSeats} onCommit={n => setMins(m => ({ ...m, maxRowSeats: n }))} className={field} />
                  </label>
                </div>
                <div className="mt-2 space-y-1 text-xs font-bold">
                  {report.aisles.map(a => <p key={a.label} className={a.cm < mins.aisle ? "text-red-700" : "opacity-70"}>Gang {a.label}: {a.cm} cm</p>)}
                  {report.stageDistance !== null && <p className={report.stageDistance < mins.stage ? "text-red-700" : "opacity-70"}>Bühne → nächster Tisch: {report.stageDistance} cm</p>}
                  {report.wallMargins.map(w => <p key={w.label} className={w.cm < mins.wall ? "text-red-700" : "opacity-70"}>{w.label}: {w.cm} cm</p>)}
                  {report.aisles.length === 0 && report.stageDistance === null && report.wallMargins.length === 0 && <p className="opacity-60">Noch keine messbaren Abstände (Reihen/Bühne/Zeltgrenze fehlen).</p>}
                </div>
                {report.violations.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">
                    {report.violations.map(v => <p key={v}>{v}</p>)}
                  </div>
                )}
              </details>
            </>
          )}
          {step === 5 && (
            <>
              <h3 className="font-display font-bold">Nummerierung</h3>
              <div className="space-y-2">
                {SCHEMES.map(s => (
                  <button key={s.key} type="button" onClick={() => setNumbering(n => ({ ...n, scheme: s.key }))} className={`w-full rounded-xl border p-3 text-left transition-colors ${numbering.scheme === s.key ? "border-accent-green bg-accent-green/10" : "border-border-light bg-white hover:border-accent-green"}`}>
                    <p className="text-sm font-bold">{s.label}</p>
                    <p className="text-xs opacity-70">{s.desc} · Bsp. {s.example}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                <label className="block">Leserichtung
                  <select value={numbering.direction} onChange={e => setNumbering(n => ({ ...n, direction: e.target.value as 'rows' | 'columns' }))} className={field}>
                    <option value="rows">Zeilenweise (Reihe für Reihe)</option>
                    <option value="columns">Spaltenweise</option>
                  </select>
                </label>
                <label className="block">Reihen-Label
                  <select value={numbering.rowStyle} onChange={e => setNumbering(n => ({ ...n, rowStyle: e.target.value as 'long' | 'short' | 'alpha' }))} className={field}>
                    <option value="long">Reihe 1, Reihe 2 …</option>
                    <option value="short">R1, R2 …</option>
                    <option value="alpha">A, B, C …</option>
                  </select>
                </label>
                <label className="block">Tisch-Präfix
                  <input value={numbering.prefix} maxLength={6} onChange={e => setNumbering(n => ({ ...n, prefix: e.target.value }))} className={field} />
                </label>
                <label className="block">Startnummer
                  <NumField min={1} value={numbering.start} onCommit={n => setNumbering(o => ({ ...o, start: n }))} className={field} />
                </label>
                <label className="block">Reihen Start
                  <NumField min={1} value={numbering.rowStart} onCommit={n => setNumbering(o => ({ ...o, rowStart: n }))} className={field} />
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={numbering.reverse} onChange={e => setNumbering(n => ({ ...n, reverse: e.target.checked }))} className="h-4 w-4 accent-accent-green" />
                  Richtung umdrehen
                </label>
                {numbering.scheme === 'oddEven' && (
                  <label className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" checked={numbering.oddLeft} onChange={e => setNumbering(n => ({ ...n, oddLeft: e.target.checked }))} className="h-4 w-4 accent-accent-green" />
                    Ungerade links vom Mittelgang (Theater-Art)
                  </label>
                )}
              </div>
              {numbering.scheme === 'zones' && (
                <div className="space-y-2 rounded-xl border border-border-light p-3">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Nummernkreise je Bereich</p>
                  {zoneGroups.map(g => (
                    <label key={g.id} className="flex items-center justify-between gap-2 text-sm font-bold">
                      {g.label}
                      <NumField min={1} value={numbering.zoneStarts[g.id] ?? g.auto} onCommit={n => setNumbering(o => ({ ...o, zoneStarts: { ...o.zoneStarts, [g.id]: n } }))} className="w-24 rounded-lg border border-border-light p-2" />
                    </label>
                  ))}
                </div>
              )}
              <div className="rounded-xl bg-canvas-light p-3 text-xs font-bold">
                <p className="mb-1 uppercase tracking-widest opacity-60">Vorschau</p>
                <p>{previewLabels.join(', ') || '–'}</p>
                <p className="mt-1 opacity-70">Reihen: {previewRows.join(', ') || '–'}</p>
              </div>
              <button type="button" onClick={() => { commit(l => applyNumbering(l, numbering)); toast.showToast("Nummerierung angewendet.", "success"); }} className="min-h-11 w-full rounded-xl bg-accent-green font-bold text-white">Nummerierung anwenden</button>
              <p className="text-xs text-base-dark/60">Jede physische Garnitur erhält eine eigene Nummer (auch zusammengestellte). Reihen werden nach Position sortiert, Tische innerhalb der Reihe entlang ihrer Achse; freie Tische kommen danach.</p>
            </>
          )}
          {step === 6 && (
            <>
              <h3 className="font-display font-bold">Prüfen & Speichern</h3>
              <div className="rounded-xl bg-canvas-light p-3 text-sm font-bold">
                <p>{tables.length} Tische · {summary.totalSeats} Plätze · {rows.length} Reihen · {layout.elements.filter(el => el.kind === 'door').length} Türen</p>
                {summary.perArea.map(a => <p key={a.label} className="mt-1 opacity-70">{a.label}: {a.tables} Tische · {a.seats} Plätze</p>)}
                {summary.freeTables > 0 && <p className="mt-1 opacity-70">Ohne Bereich: {summary.freeTables} Tische · {summary.freeSeats} Plätze</p>}
              </div>
              {summary.outside > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-800">{summary.outside} Tische liegen außerhalb der Zeltgrenze.</p>}
              {summary.overlaps > 0 && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">{summary.overlaps} Tisch-Überlappungen – bitte im Bearbeiten-Modus korrigieren.</p>}
              {summary.outside === 0 && summary.overlaps === 0 && <p className="rounded-lg bg-green-50 p-2 text-sm font-bold text-green-800">Keine Kollisionen, alle Tische innerhalb der Zeltgrenze.</p>}
              <button type="button" onClick={save} disabled={saveState === "saving"} className="min-h-11 w-full rounded-xl bg-accent-green font-black text-white disabled:opacity-50">{saveState === "saving" ? "Speichert…" : "Plan speichern"}</button>
              <button type="button" onClick={() => gotoStep(7)} className="min-h-11 w-full rounded-xl border border-border-light font-bold">Weiter zu „Bearbeiten“</button>
            </>
          )}
          {step === 7 && (
            <>
              <h3 className="font-display font-bold">Bearbeiten</h3>
              <div className="flex flex-wrap gap-2">
                {EDIT_TOOLS.map(t => (
                  <button key={t.key} type="button" onClick={() => { setTool(t.key); setDrawPreset(null); }} className={toolBtn(tool === t.key)}>{t.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={undo} disabled={history.length === 0} className="min-h-11 rounded-xl border border-border-light px-4 text-sm font-bold disabled:opacity-40">↩ Undo</button>
                <button type="button" onClick={redo} disabled={future.length === 0} className="min-h-11 rounded-xl border border-border-light px-4 text-sm font-bold disabled:opacity-40">↪ Redo</button>
              </div>
              <p className="text-xs text-base-dark/60">Klick wählt die <strong>höchste Gruppe</strong> (Bereich › Reihe › Tisch), Doppelklick geht eine Ebene tiefer, Esc eine hoch. <strong>Shift+Klick</strong> oder Rahmen auf leerer Fläche = mehrere auswählen; <strong>Entf löscht alles Ausgewählte</strong> samt Inhalt. Ziehen verschiebt die Auswahl gemeinsam, <strong>Ecken-Handles</strong> passen die Größe an, Pfeiltasten = 10 cm (Shift = 50 cm), Ctrl+Z/Y = Undo/Redo, Ctrl+D = duplizieren. Auswahl-, Hand- und Maß-Switch sowie Undo/Duplizieren/Löschen sitzen unten im Plan und funktionieren in jedem Step.</p>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" disabled={step === 1} onClick={() => gotoStep((step - 1) as Step)} className="min-h-11 flex-1 rounded-xl border border-border-light font-bold disabled:opacity-40">← Zurück</button>
            <button type="button" disabled={step === 7} onClick={() => gotoStep((step + 1) as Step)} className="min-h-11 flex-1 rounded-xl bg-base-dark font-bold text-white disabled:opacity-40">Weiter →</button>
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="h-[68vh] min-h-[420px] overflow-hidden rounded-2xl border border-border-light">
            <PlanCanvas
              layout={layout}
              mode="edit"
              tool={tool}
              selectedIds={selectedIds}
              rowSpec={step === 3 ? rowSpec : null}
              doorSpec={tool === "door" ? { width: doorWidth, label: doorLabel } : null}
              onCreateDoor={createDoor}
              drawPreset={drawPreset}
              showDims={showDims}
              measureMode={measureMode}
              measurements={measurements}
              selectedMeasure={selectedMeasure}
              onMeasureSelect={setSelectedMeasure}
              onUndo={undo}
              onRedo={redo}
              canUndo={history.length > 0}
              canRedo={future.length > 0}
              onDuplicate={duplicateSelected}
              onDeleteSelected={deleteSelected}
              onTogglePan={togglePan}
              onToggleSelect={toggleSelect}
              onToggleDims={() => setShowDims(v => !v)}
              onMeasure={addMeasurement}
              onResize={(id, rect) => {
                if (!moveStartedRef.current) { pushHistory(layout); moveStartedRef.current = true; }
                setLayout(l => ({ ...l, elements: l.elements.map(el => el.id === id ? { ...el, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) } : el) }));
                setDirty(true);
              }}
              onSelect={setSelectedIds}
              onMoveStart={() => { moveStartedRef.current = false; }}
              onMoveGroup={(ids, dx, dy) => {
                if (!moveStartedRef.current) { pushHistory(layout); moveStartedRef.current = true; }
                setLayout(l => ids.reduce((acc, id) => moveGroup(acc, id, dx, dy), l));
                setDirty(true);
              }}
              onCreateRect={createRect}
              onCreateTable={createTable}
              onPlaceRow={placeRow}
              onLabelPoint={createLabel}
            />
          </div>
        </div>

        <div className="w-full shrink-0 rounded-2xl border border-border-light bg-white p-4 lg:w-72">
          <h3 className="mb-2 font-display font-bold">Eigenschaften</h3>
          {breadcrumb.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1 text-xs font-bold text-base-dark/60">
              {breadcrumb.map((el, i) => (
                <span key={el.id} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>›</span>}
                  <button type="button" onClick={() => setSelectedIds([el.id])} className={`rounded px-1 hover:bg-canvas-light ${el.id === selectedIds[0] ? "text-accent-green" : ""}`}>
                    {el.kind === 'table' ? `Tisch ${el.number}` : el.kind === 'row' ? el.label : el.kind === 'area' ? el.label || 'Bereich' : el.kind === 'stage' ? el.label || 'Bühne' : el.kind === 'boundary' ? el.label || 'Zelt' : el.kind === 'wall' ? 'Wand' : el.kind === 'door' ? el.label : el.text}
                  </button>
                </span>
              ))}
            </div>
          )}
          {(step === 4 || tool === "measure" || measurements.length > 0) && (
            <section className="mb-4 space-y-2 rounded-xl bg-canvas-light p-3" aria-labelledby="measurements-heading">
              <div className="flex items-center justify-between gap-2">
                <p id="measurements-heading" className="text-xs font-bold uppercase tracking-widest opacity-60">Eigene Maße</p>
                <span className="text-xs font-bold opacity-60">{measurements.length}</span>
              </div>
              {measurements.length === 0 && <p className="text-xs text-base-dark/60">Mit <strong>Neues Maß aufnehmen</strong> oder dem Werkzeug <strong>Messen</strong> zwei Punkte anklicken. Das Maß wird automatisch gespeichert und ist standardmäßig im Druck enthalten.</p>}
              {measurements.map((m, i) => {
                const dx = Math.round(m.b.x - m.a.x);
                const dy = Math.round(m.b.y - m.a.y);
                const direction = dx === 0 ? "senkrecht" : dy === 0 ? "waagerecht" : "frei";
                const expanded = selectedMeasure === i;
                const measurementName = m.label?.trim() || `Maß ${i + 1}`;
                return (
                  <div key={m.id} className={`rounded-lg bg-white p-2 text-xs font-bold ${expanded ? "ring-2 ring-accent-green" : ""}`}>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-expanded={expanded} onClick={() => { setSelectedMeasure(expanded ? null : i); setSelectedIds([]); }} className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-canvas-light">
                        <span className="block truncate">{measurementName}</span>
                        <span className="block font-normal opacity-60">{measurementDistance(m)} cm · {direction}</span>
                      </button>
                      <label className="flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-canvas-light" title="Dieses Maß im Aufbau-/Druckplan anzeigen">
                        <input type="checkbox" checked={m.print !== false} onChange={e => patchMeasurement(i, { print: e.target.checked })} aria-label={`${measurementName} im Druck anzeigen`} className="h-4 w-4 accent-accent-green" />
                        <span className="mt-0.5 text-[10px] uppercase opacity-60">Druck</span>
                      </label>
                    </div>
                    {expanded && (
                      <div className="mt-2 space-y-2 border-t border-border-light pt-2">
                        <label className="block">Bezeichnung (optional)
                          <input value={m.label ?? ""} maxLength={80} placeholder="z. B. Hauptgang" onChange={e => patchMeasurement(i, { label: e.target.value })} className={field} />
                        </label>
                        <details className="rounded-lg bg-canvas-light p-2">
                          <summary className="min-h-8 cursor-pointer font-bold">Abstand durch Verschieben korrigieren</summary>
                          <p className="mt-1 font-normal text-base-dark/60">Das Element unter Punkt B wird verschoben. Andere Elemente können dadurch ihre Position ändern.</p>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <label className="block">Δx (cm)
                              <NumField value={dx} onCommit={n => adjustMeasurement(i, "x", n)} className={field} />
                            </label>
                            <label className="block">Δy (cm)
                              <NumField value={dy} onCommit={n => adjustMeasurement(i, "y", n)} className={field} />
                            </label>
                          </div>
                        </details>
                        <button type="button" onClick={() => deleteMeasurement(i)} className="min-h-10 rounded-lg px-2 font-bold text-red-600 hover:bg-red-50">Maß löschen (Undo möglich)</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {measurements.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => changeMeasurements(items => items.map(m => ({ ...m, print: true })))} className="min-h-10 rounded-lg bg-white text-xs font-bold hover:bg-white/70">Alle drucken</button>
                    <button type="button" onClick={() => changeMeasurements(items => items.map(m => ({ ...m, print: false })))} className="min-h-10 rounded-lg bg-white text-xs font-bold hover:bg-white/70">Keine drucken</button>
                  </div>
                  <button type="button" onClick={clearMeasurements} className="min-h-10 w-full rounded-lg text-xs font-bold text-red-600 hover:bg-red-50">Alle eigenen Maße löschen</button>
                </>
              )}
              <p className="text-[11px] font-normal text-base-dark/60">Eigene Maße sind freie Linien. Nach dem Verschieben von Bauteilen ihre Position bitte kurz prüfen.</p>
            </section>
          )}
          {selectedIds.length > 1 && (
            <div className="mb-4 space-y-2 rounded-xl bg-canvas-light p-3">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Ausrichten ({selectedIds.length})</p>
              <div className="flex flex-wrap gap-1">
                {([["left", "Links"], ["right", "Rechts"], ["top", "Oben"], ["bottom", "Unten"], ["cx", "Mitte H"], ["cy", "Mitte V"]] as const).map(([m, l]) => (
                  <button key={m} type="button" onClick={() => alignSelected(m)} className="min-h-9 rounded-lg border border-border-light bg-white px-2 text-xs font-bold hover:border-accent-green">{l}</button>
                ))}
                <button type="button" onClick={() => distributeSelected("x")} disabled={selectedIds.length < 3} className="min-h-9 rounded-lg border border-border-light bg-white px-2 text-xs font-bold hover:border-accent-green disabled:opacity-40">Verteilen H</button>
                <button type="button" onClick={() => distributeSelected("y")} disabled={selectedIds.length < 3} className="min-h-9 rounded-lg border border-border-light bg-white px-2 text-xs font-bold hover:border-accent-green disabled:opacity-40">Verteilen V</button>
              </div>
            </div>
          )}
          {!selected && selectedIds.length === 0 && <p className="text-sm text-base-dark/60">Element auswählen oder links ein Werkzeug nutzen. In „Bearbeiten“: Klick = Gruppe, Doppelklick = Ebene tiefer, Shift+Klick oder Rahmen aufziehen = mehrere auswählen.</p>}
          {selectedIds.length > 1 && (
            <div className="space-y-3 text-sm font-bold">
              <p>{selectedIds.length} Gruppen ausgewählt.</p>
              <p className="text-xs text-base-dark/60">Ziehen verschiebt alle gemeinsam, Pfeiltasten ebenso. Entf löscht alles Ausgewählte samt Inhalt.</p>
              <button type="button" onClick={deleteSelected} className="min-h-11 w-full rounded-xl border border-red-200 font-bold text-red-600 hover:bg-red-50">Alle ausgewählten löschen</button>
            </div>
          )}
          {selected && (
            <div className="space-y-3 text-sm font-bold">
              {(selected.kind === "area" || selected.kind === "stage" || selected.kind === "boundary" || selected.kind === "row" || selected.kind === "door") && (
                <label className="block">Beschriftung
                  <input value={selected.kind === "boundary" || selected.kind === "row" ? selected.label ?? "" : selected.label} onChange={e => patchElement(selected.id, { label: e.target.value })} className={field} />
                </label>
              )}
              {selected.kind === "area" && (
                <div>
                  <p className="mb-1">Farbe</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {AREA_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Farbe ${c}`}
                        aria-pressed={selected.color === c}
                        onClick={() => patchElement(selected.id, { color: c })}
                        className={`h-8 w-8 rounded-lg border-2 ${selected.color === c ? "border-base-dark ring-2 ring-accent-green" : "border-border-light"}`}
                        style={{ background: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={selected.color}
                      onChange={e => patchElement(selected.id, { color: e.target.value })}
                      aria-label="Eigene Farbe wählen"
                      title="Eigene Farbe"
                      className="h-8 w-8 cursor-pointer rounded-lg border-2 border-border-light bg-white p-0.5"
                    />
                  </div>
                </div>
              )}
              {selected.kind === "label" && (
                <>
                  <label className="block">Text
                    <input value={selected.text} onChange={e => patchElement(selected.id, { text: e.target.value })} className={field} />
                  </label>
                  <label className="block">Schriftgröße (cm)
                    <NumField min={20} value={selected.size ?? 60} onCommit={n => patchElement(selected.id, { size: n })} className={field} />
                  </label>
                </>
              )}
              {selected.kind === "row" && (
                <p className="text-xs text-base-dark/60">{tablesOfRow(layout, selected.id).length} Tische · {selected.stackVertical ? "untereinander" : "nebeneinander"}. Einzelne Tische bearbeiten: Doppelklick auf die Reihe, dann auf den Tisch.</p>
              )}
              {selected.kind === "door" && (
                <>
                  <label className="block">Breite (cm)
                    <NumField min={50} value={Math.round(selected.vertical ? selected.h : selected.w)} onCommit={n => patchElement(selected.id, selected.vertical ? { h: n } : { w: n })} className={field} />
                  </label>
                  <p className="text-xs text-base-dark/60">Öffnung in {selected.vertical ? "senkrechter" : "waagerechter"} Wand/Zeltgrenze. Verschieben nur entlang der Wand.</p>
                </>
              )}
              {selected.kind === "table" && (
                <>
                  <label className="block">Nummer
                    <NumField min={1} value={selected.number} onCommit={n => patchElement(selected.id, { number: n })} className={field} />
                  </label>
                  <label className="block">Personen
                    <NumField min={1} value={selected.capacity} onCommit={n => patchElement(selected.id, { capacity: n })} className={field} />
                  </label>
                  <label className="block">Form
                    <select value={selected.shape} onChange={e => patchElement(selected.id, { shape: e.target.value })} className={field}>
                      <option value="rect">Biergarnitur (eckig)</option>
                      <option value="round">Rund</option>
                    </select>
                  </label>
                  <label className="block">Tischbreite (Platte, cm)
                    <NumField min={20} value={Math.round(selected.vertical ? selected.h : selected.w)} onCommit={n => patchTable(selected, { plateW: n })} className={field} />
                  </label>
                  <label className="block">Tischtiefe (Platte, cm)
                    <NumField min={10} value={Math.round((selected.vertical ? selected.w : selected.h) - 2 * ((selected.benchDepth ?? 0) + (selected.benchGap ?? 0)))} onCommit={n => patchTable(selected, { plateH: n })} className={field} />
                  </label>
                  <label className="block">Banktiefe (cm)
                    <NumField min={0} value={selected.benchDepth ?? 0} onCommit={n => patchTable(selected, { benchDepth: n })} className={field} />
                  </label>
                  <label className="block">Abstand Bank–Tisch (cm)
                    <NumField min={0} value={selected.benchGap ?? 0} onCommit={n => patchTable(selected, { benchGap: n })} className={field} />
                  </label>
                  <p className="rounded-lg bg-canvas-light p-2 text-xs opacity-80">Gesamtmaß: {Math.round(selected.w)} × {Math.round(selected.h)} cm</p>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={selected.vip ?? false} onChange={e => patchElement(selected.id, { vip: e.target.checked })} className="h-4 w-4 accent-accent-green" /> VIP-Tisch</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={selected.blocked ?? false} onChange={e => patchElement(selected.id, { blocked: e.target.checked })} className="h-4 w-4 accent-accent-green" /> Gesperrt (nicht buchbar)</label>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">X (cm)
                  <NumField value={Math.round(selected.x)} onCommit={n => setPosition(selected.id, "x", n)} className={field} />
                </label>
                <label className="block">Y (cm)
                  <NumField value={Math.round(selected.y)} onCommit={n => setPosition(selected.id, "y", n)} className={field} />
                </label>
                {selected.kind !== "label" && selected.kind !== "table" && selected.kind !== "door" && (
                  <>
                    <label className="block">Breite (cm)
                      <NumField min={10} value={Math.round(selected.w)} onCommit={n => patchElement(selected.id, { w: n })} className={field} />
                    </label>
                    <label className="block">Höhe (cm)
                      <NumField min={10} value={Math.round(selected.h)} onCommit={n => patchElement(selected.id, { h: n })} className={field} />
                    </label>
                  </>
                )}
              </div>
              <button type="button" onClick={deleteSelected} className="min-h-11 w-full rounded-xl border border-red-200 font-bold text-red-600 hover:bg-red-50">Gruppe löschen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}