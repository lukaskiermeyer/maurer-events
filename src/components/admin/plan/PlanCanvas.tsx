"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeDimensions, descendantIds, drillDownAt, highestGroupAt, isAncestorOf, measurementDistance, measurementEndpoint, nearestWallDoor, planBounds, rowBlockGeometry, snapCandidates, snapValue, tableLabel,
  type MeasurementMode, type PlanElement, type PlanLayout, type PlanMeasurement, type PlanTable, type RowSpec, type TableOccupancy,
} from "@/lib/plan-types";

export type { TableOccupancy };
export type PlanTool = "select" | "pan" | "area" | "boundary" | "stage" | "wall" | "door" | "table" | "row" | "label" | "measure";
export interface DrawPreset { label?: string; color?: string }
export type Measurement = PlanMeasurement;
export interface DoorSpec { width: number; label: string }

const KIND_ORDER: Record<PlanElement["kind"], number> = { area: 0, boundary: 1, wall: 2, door: 3, row: 4, stage: 5, table: 6, label: 7 };

function tableFill(t: PlanTable, occ: TableOccupancy | undefined, edit: boolean, neutral = false): { fill: string; stroke: string; text: string } {
  if (neutral) return { fill: "#FFFFFF", stroke: "#4B5563", text: "#1A1A1A" };
  if (edit) {
    if (t.blocked) return { fill: "#9CA3AF", stroke: "#4B5563", text: "#111827" };
    if (t.vip) return { fill: "#FBBF24", stroke: "#B45309", text: "#78350F" };
    return { fill: "#F97316", stroke: "#C2410C", text: "#7C2D12" };
  }
  switch (occ?.kind) {
    case "reserved": return { fill: "#1F5732", stroke: "#164426", text: "#FFFFFF" };
    case "vip": return { fill: "#F59E0B", stroke: "#B45309", text: "#78350F" };
    case "blocked": return { fill: "#9CA3AF", stroke: "#4B5563", text: "#111827" };
    default: return { fill: "#FFFFFF", stroke: "#1F5732", text: "#1F5732" };
  }
}

export function PlanElements({ layout, occupancy, edit = false, neutral = false, selectedIds, onTableClick, onTableDrop }: {
  layout: PlanLayout;
  occupancy?: Record<string, TableOccupancy>;
  edit?: boolean;
  neutral?: boolean;
  selectedIds?: string[];
  onTableClick?: (id: string) => void;
  onTableDrop?: (reservationId: string, tableId: string) => void;
}) {
  const sorted = [...layout.elements].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return (
    <g>
      {sorted.map(el => {
        const selected = selectedIds?.includes(el.id) ?? false;
        if (el.kind === "area") {
          const dark = el.color === "#1A1A1A" || el.color === "#5F8575" || el.color === "#8B4A2B" || el.color === "#1F78B4";
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={el.color} stroke={selected ? "#2563EB" : "#00000055"} strokeWidth={selected ? 12 : 4} />
              {el.label && <text x={el.x + el.w / 2} y={el.y + el.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(24, Math.min(Math.max(60, Math.min(el.w, el.h) / 6), el.w / (Math.max(1, el.label.length) * 0.62)))} fontWeight={700} fill={dark ? "#FFFFFF" : "#1A1A1A"} style={{ pointerEvents: "none" }}>{el.label}</text>}
            </g>
          );
        }
        if (el.kind === "boundary") {
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="none" stroke={selected ? "#2563EB" : "#1A1A1A"} strokeWidth={selected ? 16 : 10} strokeDasharray="60 30" />
              {el.label && <text x={el.x + 20} y={el.y - 25} fontSize={55} fontWeight={700} fill="#1A1A1A" style={{ pointerEvents: "none" }}>{el.label}</text>}
            </g>
          );
        }
        if (el.kind === "wall") {
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#4B5563" stroke={selected ? "#2563EB" : "#1F2937"} strokeWidth={selected ? 12 : 4} />
            </g>
          );
        }
        if (el.kind === "door") {
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#F4F0E8" stroke={selected ? "#2563EB" : "#1F5732"} strokeWidth={selected ? 12 : 6} />
              <text x={el.vertical ? el.x + el.w + 25 : el.x + el.w / 2} y={el.vertical ? el.y + el.h / 2 : el.y - 25} textAnchor={el.vertical ? "start" : "middle"} dominantBaseline="middle" fontSize={42} fontWeight={700} fill="#1F5732" style={{ pointerEvents: "none" }}>{el.label}</text>
            </g>
          );
        }
        if (el.kind === "row") {
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#00000008" stroke={selected ? "#2563EB" : "#00000035"} strokeWidth={selected ? 10 : 3} strokeDasharray="30 20" />
              <text x={el.x} y={el.y - 20} fontSize={45} fontWeight={700} fill={selected ? "#2563EB" : "#555555"} style={{ pointerEvents: "none" }}>{el.label}</text>
            </g>
          );
        }
        if (el.kind === "stage") {
          return (
            <g key={el.id}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#8B4A2B" stroke={selected ? "#2563EB" : "#5C3018"} strokeWidth={selected ? 12 : 5} />
              <text x={el.x + el.w / 2} y={el.y + el.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(50, Math.min(el.w, el.h) / 5)} fontWeight={700} fill="#FFFFFF" style={{ pointerEvents: "none" }}>{el.label || "Bühne"}</text>
            </g>
          );
        }
        if (el.kind === "label") {
          return (
            <text key={el.id} x={el.x} y={el.y} fontSize={el.size ?? 60} fontWeight={700} fill={selected ? "#2563EB" : "#1A1A1A"}>{el.text}</text>
          );
        }
        const occ = occupancy?.[el.id];
        const c = tableFill(el, occ, edit, neutral);
        const fontSize = Math.max(24, Math.min(el.w, el.h) * 0.38);
        const dropProps = onTableDrop ? {
          onDragOver: (e: React.DragEvent) => e.preventDefault(),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const rid = e.dataTransfer.getData("text/reservation");
            if (rid) { onTableDrop(rid, el.id); return; }
            const cid = e.dataTransfer.getData("text/customer");
            if (cid) onTableDrop(`customer:${cid}`, el.id);
          },
        } : {};
        const bench = el.benchDepth ?? 0;
        const inset = bench + (el.benchGap ?? 0);
        const plate = el.vertical
          ? { x: el.x + inset, y: el.y, w: el.w - 2 * inset, h: el.h }
          : { x: el.x, y: el.y + inset, w: el.w, h: el.h - 2 * inset };
        return (
          <g key={el.id} {...dropProps} onClick={onTableClick ? () => onTableClick(el.id) : undefined} style={{ cursor: onTableClick ? "pointer" : undefined }}>
            {el.shape === "round"
              ? <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={c.fill} stroke={selected ? "#2563EB" : c.stroke} strokeWidth={selected ? 12 : 6} />
              : bench > 0 ? (
                <>
                  <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#00000012" stroke={selected ? "#2563EB" : c.stroke} strokeWidth={selected ? 10 : 3} />
                  {el.vertical ? (
                    <>
                      <rect x={el.x} y={el.y} width={bench} height={el.h} fill={c.stroke} />
                      <rect x={el.x + el.w - bench} y={el.y} width={bench} height={el.h} fill={c.stroke} />
                    </>
                  ) : (
                    <>
                      <rect x={el.x} y={el.y} width={el.w} height={bench} fill={c.stroke} />
                      <rect x={el.x} y={el.y + el.h - bench} width={el.w} height={bench} fill={c.stroke} />
                    </>
                  )}
                  <rect x={plate.x} y={plate.y} width={Math.max(10, plate.w)} height={Math.max(10, plate.h)} fill={c.fill} stroke={c.stroke} strokeWidth={4} />
                </>
              ) : <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={c.fill} stroke={selected ? "#2563EB" : c.stroke} strokeWidth={selected ? 12 : 6} />}
            <text x={el.x + el.w / 2} y={el.y + el.h / 2 - (occ && occ.kind === "reserved" ? fontSize * 0.35 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={800} fill={c.text} style={{ pointerEvents: "none" }}>{tableLabel(layout, el)}</text>
            {!edit && occ && occ.kind === "reserved" && (
              <text x={el.x + el.w / 2} y={el.y + el.h / 2 + fontSize * 0.6} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize * 0.6} fontWeight={700} fill={c.text} style={{ pointerEvents: "none" }}>{occ.guests} P.</text>
            )}
            {el.vip && edit && <text x={el.x + el.w / 2} y={el.y - 15} textAnchor="middle" fontSize={40} fontWeight={800} fill="#B45309" style={{ pointerEvents: "none" }}>VIP</text>}
          </g>
        );
      })}
    </g>
  );
}

/** Maßketten (rote Linien + cm-Labels) für Editor und Aufbau-Druck. */
export function PlanDimensions({ layout }: { layout: PlanLayout }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {computeDimensions(layout).map((d, i) => {
        const vertical = d.x1 === d.x2;
        const mx = (d.x1 + d.x2) / 2;
        const my = (d.y1 + d.y2) / 2;
        const tx = vertical ? 20 : 0;
        const ty = vertical ? 0 : 20;
        return (
          <g key={`dim-${i}`}>
            <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="#D32F2F" strokeWidth={3} />
            <line x1={d.x1 - tx} y1={d.y1 - ty} x2={d.x1 + tx} y2={d.y1 + ty} stroke="#D32F2F" strokeWidth={3} />
            <line x1={d.x2 - tx} y1={d.y2 - ty} x2={d.x2 + tx} y2={d.y2 + ty} stroke="#D32F2F" strokeWidth={3} />
            {vertical ? (
              <text transform={`translate(${mx - 12} ${my}) rotate(-90)`} textAnchor="middle" dominantBaseline="middle" fontSize={42} fontWeight={700} fill="#D32F2F" stroke="#FFFFFF" strokeWidth={12} paintOrder="stroke">{d.label}</text>
            ) : (
              <text x={mx} y={my - 12} textAnchor="middle" dominantBaseline="middle" fontSize={42} fontWeight={700} fill="#D32F2F" stroke="#FFFFFF" strokeWidth={12} paintOrder="stroke">{d.label}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Eigene Maße verwenden im Druck dieselbe klare Darstellung wie Auto-Maßketten. */
export function PlanMeasurements({ measurements, selectedMeasure = null, onMeasureSelect, draft = false }: {
  measurements: PlanMeasurement[];
  selectedMeasure?: number | null;
  onMeasureSelect?: (i: number | null) => void;
  draft?: boolean;
}) {
  return (
    <g>
      {measurements.map((m, i) => {
        const dx = Math.round(m.b.x - m.a.x);
        const dy = Math.round(m.b.y - m.a.y);
        const length = Math.hypot(dx, dy);
        const dist = measurementDistance(m);
        const interactive = !draft && !!onMeasureSelect;
        const sel = interactive && selectedMeasure === i;
        const color = sel ? "#2563EB" : "#D32F2F";
        const mx = (m.a.x + m.b.x) / 2;
        const my = (m.a.y + m.b.y) / 2;
        const nx = length > 0 ? -dy / length * 18 : 0;
        const ny = length > 0 ? dx / length * 18 : 18;
        const label = `${m.label?.trim() ? `${m.label.trim()}: ` : ""}${dist} cm`;
        return (
          <g
            key={m.id}
            style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "pointer" : undefined }}
            onPointerDown={interactive ? e => { e.stopPropagation(); onMeasureSelect?.(sel ? null : i); } : undefined}
          >
            {interactive && <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="transparent" strokeWidth={60} />}
            <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke={color} strokeWidth={sel ? 7 : 4} strokeDasharray={draft ? "25 15" : undefined} />
            <line x1={m.a.x - nx} y1={m.a.y - ny} x2={m.a.x + nx} y2={m.a.y + ny} stroke={color} strokeWidth={4} />
            <line x1={m.b.x - nx} y1={m.b.y - ny} x2={m.b.x + nx} y2={m.b.y + ny} stroke={color} strokeWidth={4} />
            {(draft || sel) && <><circle cx={m.a.x} cy={m.a.y} r={12} fill={color} /><circle cx={m.b.x} cy={m.b.y} r={12} fill={color} /></>}
            <text x={mx + 20} y={my - 20} fontSize={44} fontWeight={800} fill={color} stroke="#FFFFFF" strokeWidth={12} paintOrder="stroke">{label}</text>
            {sel && dx !== 0 && dy !== 0 && <text x={mx + 20} y={my + 35} fontSize={34} fontWeight={600} fill={color} stroke="#FFFFFF" strokeWidth={10} paintOrder="stroke">Δx {dx} · Δy {dy}</text>}
          </g>
        );
      })}
    </g>
  );
}

/** Statischer SVG für Druck (A3) — füllt die viewBox komplett. */
export function PlanStaticSvg({ layout, occupancy, showDims = false, neutral = false, edit = false, className }: { layout: PlanLayout; occupancy?: Record<string, TableOccupancy>; showDims?: boolean; neutral?: boolean; edit?: boolean; className?: string }) {
  const pad = showDims ? 260 : 120;
  const b = planBounds(layout);
  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`} className={className} role="img" aria-label="Tischplan">
      <PlanElements layout={layout} occupancy={occupancy} neutral={neutral} edit={edit} />
      {showDims && <PlanDimensions layout={layout} />}
      {showDims && <PlanMeasurements measurements={(layout.measurements ?? []).filter(m => m.print !== false)} />}
    </svg>
  );
}

interface Draft { x: number; y: number; w: number; h: number }
type Drag =
  | { type: "pan"; startX: number; startY: number; origX: number; origY: number }
  | { type: "move"; ids: string[]; startX: number; startY: number; lastDx: number; lastDy: number; bbox: Draft; snapIds: Set<string> }
  | { type: "draw"; kind: "area" | "boundary" | "stage" | "wall"; startX: number; startY: number }
  | { type: "resize"; id: string; corner: "nw" | "ne" | "sw" | "se"; orig: Draft }
  | { type: "marquee"; startX: number; startY: number; additive: boolean }
  | null;

export function PlanCanvas({ layout, mode, tool = "select", occupancy, selectedIds, rowSpec, doorSpec, drawPreset, showDims = false, measureMode = "axis", measurements = [], selectedMeasure = null, onMeasureSelect, onTogglePan, onToggleSelect, onToggleDims, onUndo, onRedo, canUndo = false, canRedo = false, onDuplicate, onDeleteSelected, onSelect, onMoveStart, onMoveGroup, onResize, onCreateRect, onCreateDoor, onCreateTable, onPlaceRow, onLabelPoint, onMeasure, onTableClick, onTableDrop }: {
  layout: PlanLayout;
  mode: "edit" | "view";
  tool?: PlanTool;
  occupancy?: Record<string, TableOccupancy>;
  selectedIds?: string[];
  rowSpec?: RowSpec | null;
  doorSpec?: DoorSpec | null;
  drawPreset?: DrawPreset | null;
  showDims?: boolean;
  measureMode?: MeasurementMode;
  measurements?: Measurement[];
  selectedMeasure?: number | null;
  onMeasureSelect?: (i: number | null) => void;
  onTogglePan?: () => void;
  onToggleSelect?: () => void;
  onToggleDims?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onDuplicate?: () => void;
  onDeleteSelected?: () => void;
  onSelect?: (ids: string[]) => void;
  onMoveStart?: () => void;
  onMoveGroup?: (ids: string[], dx: number, dy: number) => void;
  onResize?: (id: string, rect: Draft) => void;
  onCreateRect?: (kind: "area" | "boundary" | "stage" | "wall", rect: Draft, preset?: DrawPreset | null) => void;
  onCreateDoor?: (rect: Draft, wallId: string, vertical: boolean) => void;
  onCreateTable?: (point: { x: number; y: number }) => void;
  onPlaceRow?: (point: { x: number; y: number }) => void;
  onLabelPoint?: (point: { x: number; y: number }) => void;
  onMeasure?: (m: Measurement) => void;
  onTableClick?: (id: string) => void;
  onTableDrop?: (reservationId: string, tableId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 0.1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [marquee, setMarquee] = useState<Draft | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [movePos, setMovePos] = useState<{ x: number; y: number } | null>(null);
  const [doorGhost, setDoorGhost] = useState<{ rect: Draft; wallId: string; vertical: boolean } | null>(null);
  const [measureA, setMeasureA] = useState<{ x: number; y: number } | null>(null);
  const [measureHover, setMeasureHover] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const dragRef = useRef<Drag>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number; x: number; y: number } | null>(null);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    if (!cw || !ch) return;
    // Rand + tatsächliche Element-Ausdehnung einrechnen, damit Bereiche außerhalb
    // der Zeltkante und Maßketten/Labels nicht abgeschnitten werden
    const pad = 300;
    const b = planBounds({ ...layoutRef.current, widthCm: layout.widthCm, heightCm: layout.heightCm });
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const zoom = Math.min(cw / w, ch / h) * 0.98;
    setView({ zoom, x: (cw - w * zoom) / 2 + (pad - b.minX) * zoom, y: (ch - h * zoom) / 2 + (pad - b.minY) * zoom });
  }, [layout.widthCm, layout.heightCm]);

  useEffect(() => {
    fit();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setView(v => {
      const zoom = Math.min(20, Math.max(0.02, v.zoom * factor));
      const real = zoom / v.zoom;
      return { zoom, x: px - (px - v.x) * real, y: py - (py - v.y) * real };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const toPlan = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  };

  const threshold = () => 8 / viewRef.current.zoom;

  const snapPoint = (p: { x: number; y: number }, disable: boolean) => {
    const c = snapCandidates(layoutRef.current, new Set());
    const sx = snapAxis([p.x], c.xs, disable);
    const sy = snapAxis([p.y], c.ys, disable);
    return { x: p.x + sx.delta, y: p.y + sy.delta, gx: sx.guide, gy: sy.guide };
  };

  const startResize = (e: React.PointerEvent, id: string, corner: "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const el = layoutRef.current.elements.find(el => el.id === id);
    if (!el || el.kind === "label" || el.kind === "row" || el.kind === "door") return;
    onMoveStart?.();
    dragRef.current = { type: "resize", id, corner, orig: { x: el.x, y: el.y, w: el.w, h: el.h } };
  };

  // Snap einer Kante/Koordinate; liefert Führungslinie zurück.
  const snapAxis = (values: number[], candidates: number[], disable: boolean): { delta: number; guide: number | null } => {
    if (disable) return { delta: 0, guide: null };
    let best: { delta: number; guide: number } | null = null;
    for (const v of values) {
      const s = snapValue(v, candidates, threshold());
      if (s.guide !== null && (!best || Math.abs(s.value - v) < Math.abs(best.delta))) best = { delta: s.value - v, guide: s.guide };
    }
    return best ?? { delta: 0, guide: null };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, x: viewRef.current.x, y: viewRef.current.y };
      dragRef.current = null;
      setDraft(null);
      return;
    }
    const pan = mode === "view" || tool === "pan" || e.button === 1;
    if (pan) {
      dragRef.current = { type: "pan", startX: e.clientX, startY: e.clientY, origX: viewRef.current.x, origY: viewRef.current.y };
      return;
    }
    const p = toPlan(e.clientX, e.clientY);
    if (tool === "select") {
      const sel = selectedIds ?? [];
      const hit = highestGroupAt(layoutRef.current, p.x, p.y);
      if (e.shiftKey && hit) {
        onSelect?.(sel.includes(hit) ? sel.filter(i => i !== hit) : [...sel, hit]);
        return;
      }
      // Klicks innerhalb des aktuellen Auswahlbaums halten die Ebene (Doppelklick drillt tiefer).
      const keepSingle = sel.length === 1 && !!hit && (hit === sel[0] || isAncestorOf(layoutRef.current, hit, sel[0]) || isAncestorOf(layoutRef.current, sel[0], hit));
      const moveIds = hit && sel.includes(hit)
        ? sel.filter(id => !sel.some(o => o !== id && isAncestorOf(layoutRef.current, o, id)))
        : keepSingle ? sel : hit ? [hit] : null;
      if (moveIds) {
        if (!keepSingle && !sel.includes(hit!)) onSelect?.([hit!]);
        const ids = new Set(moveIds.flatMap(id => [id, ...descendantIds(layoutRef.current, id)]));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const cid of ids) {
          const ce = layoutRef.current.elements.find(el => el.id === cid);
          if (ce && ce.kind !== "label") { minX = Math.min(minX, ce.x); minY = Math.min(minY, ce.y); maxX = Math.max(maxX, ce.x + ce.w); maxY = Math.max(maxY, ce.y + ce.h); }
        }
        onMoveStart?.();
        dragRef.current = { type: "move", ids: moveIds, startX: p.x, startY: p.y, lastDx: 0, lastDy: 0, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, snapIds: ids };
      } else {
        if (!e.shiftKey) onSelect?.([]);
        dragRef.current = { type: "marquee", startX: p.x, startY: p.y, additive: e.shiftKey };
        setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
      }
    } else if (tool === "area" || tool === "boundary" || tool === "stage" || tool === "wall") {
      const s = snapPoint(p, e.altKey);
      setGuides({ x: s.gx, y: s.gy });
      dragRef.current = { type: "draw", kind: tool, startX: s.x, startY: s.y };
      setDraft({ x: s.x, y: s.y, w: 0, h: 0 });
    } else if (tool === "table") {
      onCreateTable?.(p);
    } else if (tool === "label") {
      onLabelPoint?.(p);
    } else if (tool === "row") {
      setGhost(p);
    } else if (tool === "measure") {
      const s = snapPoint(p, e.altKey);
      const q = measureA ? measurementEndpoint(measureA, { x: s.x, y: s.y }, measureMode) : { x: s.x, y: s.y };
      setGuides({ x: s.gx, y: s.gy });
      if (!measureA) { setMeasureA(q); setMeasureHover(q); }
      else {
        if (measurementDistance({ a: measureA, b: q }) > 0) onMeasure?.({ id: crypto.randomUUID(), a: measureA, b: q, print: true });
        setMeasureA(null); setMeasureHover(null); setGuides({ x: null, y: null });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const pinch = pinchRef.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = containerRef.current!.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      const zoom = Math.min(20, Math.max(0.02, pinch.zoom * (dist / pinch.dist)));
      const real = zoom / pinch.zoom;
      const ox = pinch.midX - rect.left;
      const oy = pinch.midY - rect.top;
      setView({ zoom, x: midX - (ox - pinch.x) * real, y: midY - (oy - pinch.y) * real });
      return;
    }
    const p = toPlan(e.clientX, e.clientY);
    if (mode === "edit" && tool === "door" && doorSpec) {
      setDoorGhost(nearestWallDoor(layoutRef.current, p.x, p.y, doorSpec.width));
      return;
    }
    if (mode === "edit" && tool === "measure") {
      const s = snapPoint(p, e.altKey);
      setMeasureHover(measureA ? measurementEndpoint(measureA, { x: s.x, y: s.y }, measureMode) : { x: s.x, y: s.y });
      setGuides({ x: s.gx, y: s.gy });
      return;
    }
    if (mode === "edit" && tool === "row" && rowSpec) {
      const geo = rowBlockGeometry(rowSpec, p.x, p.y);
      const cands = snapCandidates(layoutRef.current, new Set());
      const sx = snapAxis([p.x, p.x + geo.w / 2, p.x + geo.w], cands.xs, e.altKey);
      const sy = snapAxis([p.y, p.y + geo.h / 2, p.y + geo.h], cands.ys, e.altKey);
      setGhost({ x: p.x + sx.delta, y: p.y + sy.delta });
      setGuides({ x: sx.guide, y: sy.guide });
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "pan") {
      setView(v => ({ ...v, x: drag.origX + e.clientX - drag.startX, y: drag.origY + e.clientY - drag.startY }));
    } else if (drag.type === "move") {
      let dx = p.x - drag.startX;
      let dy = p.y - drag.startY;
      const cands = snapCandidates(layoutRef.current, drag.snapIds);
      const b = drag.bbox;
      const sx = snapAxis([b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], cands.xs, e.altKey);
      const sy = snapAxis([b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], cands.ys, e.altKey);
      dx += sx.delta; dy += sy.delta;
      // Türen bleiben in ihrer Wand: nur entlang der Wandachse, innerhalb der Wand.
      if (drag.ids.length === 1) {
        const sel = layoutRef.current.elements.find(el => el.id === drag.ids[0]);
        if (sel?.kind === "door") {
          const wall = layoutRef.current.elements.find(el => el.id === sel.wallId);
          if (wall && (wall.kind === "wall" || wall.kind === "boundary")) {
            if (sel.vertical) { dx = 0; dy = Math.min(Math.max(dy, wall.y - sel.y), wall.y + wall.h - sel.h - sel.y); }
            else { dy = 0; dx = Math.min(Math.max(dx, wall.x - sel.x), wall.x + wall.w - sel.w - sel.x); }
          }
        }
      }
      setGuides({ x: sx.guide, y: sy.guide });
      setMovePos({ x: b.x + dx, y: b.y + dy });
      onMoveGroup?.(drag.ids, dx - drag.lastDx, dy - drag.lastDy);
      drag.lastDx = dx; drag.lastDy = dy;
    } else if (drag.type === "resize") {
      const o = drag.orig;
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      const cands = snapCandidates(layoutRef.current, new Set([drag.id]));
      const sx = snapAxis([p.x], cands.xs, e.altKey);
      const sy = snapAxis([p.y], cands.ys, e.altKey);
      const px = p.x + sx.delta, py = p.y + sy.delta;
      if (drag.corner.includes("w")) x1 = Math.min(px, x2 - 10); else x2 = Math.max(px, x1 + 10);
      if (drag.corner.includes("n")) y1 = Math.min(py, y2 - 10); else y2 = Math.max(py, y1 + 10);
      setGuides({ x: sx.guide, y: sy.guide });
      onResize?.(drag.id, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    } else if (drag.type === "marquee") {
      setMarquee({ x: Math.min(drag.startX, p.x), y: Math.min(drag.startY, p.y), w: Math.abs(p.x - drag.startX), h: Math.abs(p.y - drag.startY) });
    } else {
      let x2 = p.x, y2 = p.y;
      const cands = snapCandidates(layoutRef.current, new Set());
      const sx = snapAxis([x2], cands.xs, e.altKey);
      const sy = snapAxis([y2], cands.ys, e.altKey);
      if (sx.guide !== null) x2 = sx.guide;
      if (sy.guide !== null) y2 = sy.guide;
      setGuides({ x: sx.guide, y: sy.guide });
      setDraft({ x: Math.min(drag.startX, x2), y: Math.min(drag.startY, y2), w: Math.abs(x2 - drag.startX), h: Math.abs(y2 - drag.startY) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasPinch = pinchRef.current !== null;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    setGuides({ x: null, y: null });
    setMovePos(null);
    if (drag?.type === "draw" && draft) {
      if (draft.w > 30 && draft.h > 30) onCreateRect?.(drag.kind, draft, drawPreset);
      setDraft(null);
    }
    if (drag?.type === "marquee" && marquee) {
      if (marquee.w > 20 || marquee.h > 20) {
        const ids: string[] = [];
        for (const el of layoutRef.current.elements) {
          const ew = 'w' in el ? el.w : 100;
          const eh = 'h' in el ? el.h : 60;
          if (el.x < marquee.x + marquee.w && marquee.x < el.x + ew && el.y < marquee.y + marquee.h && marquee.y < el.y + eh) {
            const top = el.kind === 'table' ? (el.areaId ?? el.rowId ?? el.id) : el.kind === 'row' ? (el.areaId ?? el.id) : el.kind === 'door' ? el.wallId : el.id;
            if (!ids.includes(top)) ids.push(top);
          }
        }
        const sel = selectedIds ?? [];
        onSelect?.(drag.additive ? [...new Set([...sel, ...ids])] : ids);
      }
      setMarquee(null);
    }
    if (mode === "edit" && tool === "row" && ghost && rowSpec && !wasPinch) {
      onPlaceRow?.(ghost);
    }
    if (mode === "edit" && tool === "door" && doorGhost && !wasPinch) {
      onCreateDoor?.(doorGhost.rect, doorGhost.wallId, doorGhost.vertical);
      setDoorGhost(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tool === "measure") { setMeasureA(null); setMeasureHover(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    const sel = selectedIds ?? [];
    if (mode !== "edit" || tool !== "select" || sel.length !== 1) return;
    const p = toPlan(e.clientX, e.clientY);
    const deeper = drillDownAt(layoutRef.current, sel[0], p.x, p.y);
    if (deeper) onSelect?.([deeper]);
  };

  const cursor = mode === "view" || tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";
  const ghostGeo = ghost && rowSpec ? rowBlockGeometry(rowSpec, ghost.x, ghost.y) : null;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-canvas-light" style={{ touchAction: "none", cursor }}>
      <svg
        className="absolute inset-0 h-full w-full"
        aria-label="Interaktiver Tischplan"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
          <rect x={0} y={0} width={layout.widthCm} height={layout.heightCm} fill="#FFFFFF" stroke="#00000022" strokeWidth={4} />
          <PlanElements
            layout={layout}
            occupancy={occupancy}
            edit={mode === "edit"}
            selectedIds={selectedIds}
            onTableClick={onTableClick}
            onTableDrop={onTableDrop}
          />
          {draft && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} fill="#2563EB22" stroke="#2563EB" strokeWidth={8} strokeDasharray="40 20" />}
          {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="#2563EB18" stroke="#2563EB" strokeWidth={4 / view.zoom} strokeDasharray="20 12" />}
          {mode === "edit" && tool === "select" && (selectedIds ?? []).length > 0 && (() => {
            const ids = new Set((selectedIds ?? []).flatMap(id => [id, ...descendantIds(layout, id)]));
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const id of ids) {
              const el = layout.elements.find(e => e.id === id);
              if (!el || el.kind === 'label') continue;
              minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
              maxX = Math.max(maxX, el.x + el.w); maxY = Math.max(maxY, el.y + el.h);
            }
            if (!Number.isFinite(minX)) return null;
            return <rect x={minX - 15} y={minY - 15} width={maxX - minX + 30} height={maxY - minY + 30} fill="none" stroke="#2563EB" strokeWidth={3 / view.zoom} strokeDasharray="18 12" style={{ pointerEvents: 'none' }} />;
          })()}
          {doorGhost && <rect x={doorGhost.rect.x} y={doorGhost.rect.y} width={doorGhost.rect.w} height={doorGhost.rect.h} fill="#1F573255" stroke="#1F5732" strokeWidth={6} strokeDasharray="25 15" />}
          {mode === "edit" && tool === "select" && (selectedIds ?? []).length === 1 && (() => {
            const el = layout.elements.find(e => e.id === (selectedIds ?? [])[0]);
            if (!el || el.kind === "label" || el.kind === "row" || el.kind === "door") return null;
            const hs = 12 / view.zoom;
            const corners: { c: "nw" | "ne" | "sw" | "se"; x: number; y: number }[] = [
              { c: "nw", x: el.x, y: el.y }, { c: "ne", x: el.x + el.w, y: el.y },
              { c: "sw", x: el.x, y: el.y + el.h }, { c: "se", x: el.x + el.w, y: el.y + el.h },
            ];
            return corners.map(({ c, x, y }) => (
              <rect key={c} x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} fill="#FFFFFF" stroke="#2563EB" strokeWidth={2 / view.zoom}
                style={{ cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize" }}
                onPointerDown={e => startResize(e, el.id, c)} />
            ));
          })()}
          {ghostGeo && ghost && (
            <g opacity={0.55} style={{ pointerEvents: "none" }}>
              <rect x={ghost.x} y={ghost.y} width={ghostGeo.w} height={ghostGeo.h} fill="#2563EB15" stroke="#2563EB" strokeWidth={6} strokeDasharray="30 20" />
              {ghostGeo.cells.map((c, i) => (
                rowSpec!.shape === "round"
                  ? <ellipse key={i} cx={c.x + c.w / 2} cy={c.y + c.h / 2} rx={c.w / 2} ry={c.h / 2} fill="#F97316" stroke="#C2410C" strokeWidth={4} />
                  : <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill="#F97316" stroke="#C2410C" strokeWidth={4} />
              ))}
            </g>
          )}
          {guides.x !== null && <line x1={guides.x} y1={-100000} x2={guides.x} y2={100000} stroke="#E91E63" strokeWidth={2 / view.zoom} style={{ pointerEvents: "none" }} />}
          {guides.y !== null && <line x1={-100000} y1={guides.y} x2={100000} y2={guides.y} stroke="#E91E63" strokeWidth={2 / view.zoom} style={{ pointerEvents: "none" }} />}
          {showDims && <PlanDimensions layout={layout} />}
          <PlanMeasurements measurements={measurements} selectedMeasure={selectedMeasure} onMeasureSelect={onMeasureSelect} />
          {measureA && measureHover && <PlanMeasurements measurements={[{ id: "__draft", a: measureA, b: measureHover, print: false }]} draft />}
          {mode === "edit" && tool === "measure" && !measureA && measureHover && <circle cx={measureHover.x} cy={measureHover.y} r={10} fill="#D32F2F" style={{ pointerEvents: "none" }} />}
        </g>
      </svg>
      {(draft || ghost || movePos) && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold tabular-nums text-base-dark shadow">
          {draft && <>Fläche: {Math.round(draft.w)} × {Math.round(draft.h)} cm · bei {Math.round(draft.x)} / {Math.round(draft.y)}</>}
          {ghost && rowSpec && <>Reihenblock: {Math.round(rowBlockGeometry(rowSpec, ghost.x, ghost.y).w)} × {Math.round(rowBlockGeometry(rowSpec, ghost.x, ghost.y).h)} cm · bei {Math.round(ghost.x)} / {Math.round(ghost.y)}</>}
          {movePos && !draft && !ghost && <>Position: {Math.round(movePos.x)} / {Math.round(movePos.y)} cm</>}
        </div>
      )}
      {mode === "edit" && (onUndo || onDuplicate) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-border-light bg-white/95 p-1 shadow">
          {onUndo && <button type="button" aria-label="Rückgängig (Ctrl+Z)" title="Rückgängig (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} className="h-9 w-9 rounded-lg font-black hover:bg-canvas-light disabled:opacity-30">↩</button>}
          {onRedo && <button type="button" aria-label="Wiederholen (Ctrl+Y)" title="Wiederholen (Ctrl+Y)" onClick={onRedo} disabled={!canRedo} className="h-9 w-9 rounded-lg font-black hover:bg-canvas-light disabled:opacity-30">↪</button>}
          {onDuplicate && <button type="button" aria-label="Auswahl duplizieren (Ctrl+D)" title="Auswahl duplizieren (Ctrl+D)" onClick={onDuplicate} disabled={(selectedIds ?? []).length === 0} className="h-9 w-9 rounded-lg font-black hover:bg-canvas-light disabled:opacity-30">⧉</button>}
          {onDeleteSelected && <button type="button" aria-label="Auswahl löschen (Entf)" title="Auswahl löschen (Entf)" onClick={onDeleteSelected} disabled={(selectedIds ?? []).length === 0} className="h-9 w-9 rounded-lg font-black text-red-600 hover:bg-red-50 disabled:opacity-30">🗑</button>}
        </div>
      )}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border border-border-light bg-white/95 p-1 shadow">
        {mode === "edit" && onToggleSelect && (
          <button
            type="button"
            aria-label="Auswahl: verschieben und Größe anpassen"
            aria-pressed={tool === "select"}
            title="Auswahl-Werkzeug: Elemente verschieben, Größe an Ecken anpassen (in jedem Step)"
            onClick={onToggleSelect}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${tool === "select" ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}
          ><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M5 3l14 8-6.5 1.5L16 20l-3 1.5-3.5-7.5L5 18z" /></svg></button>
        )}
        {mode === "edit" && onTogglePan && (
          <button
            type="button"
            aria-label="Hand: Plan verschieben"
            aria-pressed={tool === "pan"}
            title="Hand: Plan verschieben (in jedem Step verfügbar)"
            onClick={onTogglePan}
            className={`h-9 w-9 rounded-lg text-base ${tool === "pan" ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}
          >✋</button>
        )}
        {mode === "edit" && onToggleDims && (
          <button
            type="button"
            aria-label="Maße einblenden"
            aria-pressed={showDims}
            title="Maß-Switch: wichtige Maße im Plan ablesen"
            onClick={onToggleDims}
            className={`h-9 rounded-lg px-2 text-xs font-bold ${showDims ? "bg-accent-green text-white" : "hover:bg-canvas-light"}`}
          >Maß</button>
        )}
        <button type="button" aria-label="Herauszoomen" onClick={() => { const el = containerRef.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.3); }} className="h-9 w-9 rounded-lg font-black hover:bg-canvas-light">−</button>
        <span className="min-w-14 text-center text-xs font-bold tabular-nums">{Math.round(view.zoom * 100)}%</span>
        <button type="button" aria-label="Hineinzoomen" onClick={() => { const el = containerRef.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.3); }} className="h-9 w-9 rounded-lg font-black hover:bg-canvas-light">+</button>
        <button type="button" aria-label="Plan einpassen" onClick={fit} className="h-9 rounded-lg px-2 text-xs font-bold hover:bg-canvas-light">Einpassen</button>
      </div>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-bold text-base-dark/60 shadow">
        {mode === "edit" && tool === "measure"
          ? `2 Klicks = Maß speichern · ${measureMode === "axis" ? "waagerecht/senkrecht" : "freie Richtung"} · Esc = Startpunkt abbrechen · Alt = Snap aus`
          : <>Scrollen = Zoom · {tool === "pan" || mode === "view" ? "Ziehen = Plan verschieben" : "Hand-Icon = Plan verschieben"}{mode === "edit" && tool === "select" ? " · Doppelklick = Ebene tiefer" : ""}{mode === "edit" ? " · Alt = Snap aus" : ""}</>}
      </div>
    </div>
  );
}