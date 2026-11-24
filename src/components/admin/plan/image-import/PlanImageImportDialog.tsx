"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { PlanStaticSvg } from '@/components/admin/plan/PlanCanvas';
import NumField from '@/components/admin/plan/NumField';
import { defaultImageImportOptions, type ImageImportOptions, type PlanImageDetection } from '@/lib/plan-image-types';
import { imageDetectionToLayout } from '@/lib/plan-image-layout';
import type { PlanLayout } from '@/lib/plan-types';
import { detectPlanFile } from './read-plan-image';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const field = 'mt-1 min-h-11 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm';
const button = 'min-h-11 cursor-pointer rounded-xl border border-border-light bg-white px-4 text-sm font-bold transition-colors hover:border-accent-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green disabled:cursor-not-allowed disabled:opacity-50';

export default function PlanImageImportDialog({ onClose, onApply }: { onClose: () => void; onApply: (layout: PlanLayout) => Promise<boolean> }) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detection, setDetection] = useState<PlanImageDetection | null>(null);
  const [options, setOptions] = useState<ImageImportOptions | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => detection && options ? imageDetectionToLayout(detection, options) : null, [detection, options]);
  const tables = detection?.objects.filter(object => object.kind === 'table') ?? [];
  const otherObjects = detection?.objects.filter(object => object.kind !== 'table') ?? [];
  const includedTables = tables.filter(object => !options?.excludedIds.has(object.id));
  const reviewCount = detection?.objects.filter(object => object.confidence === 'review' && !options?.excludedIds.has(object.id)).length ?? 0;
  const includedCount = layout ? layout.elements.length - 1 : 0;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')).filter(element => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const chooseFile = (next: File | undefined) => {
    setError(null);
    if (!next) return;
    if (!ACCEPTED_TYPES.has(next.type)) { setError('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.'); return; }
    if (next.size > MAX_FILE_BYTES) { setError('Das Bild ist größer als 15 MB. Bitte eine kleinere Version verwenden.'); return; }
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setDetection(null);
    setOptions(null);
  };
  const analyze = async () => {
    if (!file) return;
    setError(null);
    setBusy('Bild wird vorbereitet …');
    try {
      const result = await detectPlanFile(file, setBusy);
      if (!result.objects.length) throw new Error('Es wurden keine geeigneten farbigen Planflächen erkannt. Nutze möglichst die originale Plandatei statt eines Fotos.');
      setDetection(result);
      setOptions(defaultImageImportOptions(result));
    } catch (cause) {
      setDetection(null);
      setOptions(null);
      setError(cause instanceof Error ? cause.message : 'Das Bild konnte nicht verarbeitet werden. Bitte eine andere Datei versuchen.');
    } finally {
      setBusy(null);
    }
  };
  const toggleObject = (id: string) => setOptions(current => {
    if (!current) return current;
    const excludedIds = new Set(current.excludedIds);
    if (excludedIds.has(id)) excludedIds.delete(id); else excludedIds.add(id);
    return { ...current, excludedIds };
  });
  const toggleTables = () => setOptions(current => {
    if (!current) return current;
    const excludedIds = new Set(current.excludedIds);
    const allExcluded = tables.every(table => excludedIds.has(table.id));
    for (const table of tables) { if (allExcluded) excludedIds.delete(table.id); else excludedIds.add(table.id); }
    return { ...current, excludedIds };
  });
  const apply = async () => {
    if (!layout || !includedCount) return;
    setBusy('Entwurf wird übernommen …');
    setError(null);
    try { await onApply(layout); }
    catch { setError('Der Entwurf konnte nicht übernommen werden. Der bisherige Plan bleibt erhalten.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-dark/70 p-2 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="image-import-title" aria-describedby="image-import-description" aria-busy={!!busy} className="max-h-[94dvh] w-full max-w-[1440px] overflow-y-auto rounded-2xl bg-canvas-light shadow-2xl outline-none">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border-light bg-white px-4 py-4 sm:px-6">
          <div>
            <h2 id="image-import-title" className="font-display text-xl font-black text-base-dark sm:text-2xl">Plan aus Bild erstellen</h2>
            <p id="image-import-description" className="mt-1 max-w-3xl text-sm leading-relaxed text-base-dark/70">Lokale Erkennung für farbige, achsenausgerichtete Zeltpläne. Kein Upload an einen externen KI-Dienst. Jede Übernahme ist ein korrigierbarer Entwurf.</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className={button} aria-label="Bildimport schließen">Schließen</button>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <section className="rounded-xl border border-border-light bg-white p-4" aria-labelledby="image-file-heading">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <label className="min-w-0 flex-1 cursor-pointer rounded-xl border-2 border-dashed border-border-light p-4 transition-colors hover:border-accent-green focus-within:border-accent-green" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) chooseFile(event.dataTransfer.files[0]); }}>
                <span id="image-file-heading" className="block text-sm font-bold">1 · Planbild auswählen oder hier ablegen</span>
                <span className="mt-1 block text-xs leading-relaxed text-base-dark/60">JPG, PNG oder WebP · maximal 15 MB / 40 Megapixel · möglichst Originaldatei ohne Perspektive</span>
                <span className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-canvas-light px-3 text-sm font-bold">{file ? file.name : 'Datei auswählen'}</span>
                <input type="file" aria-label="Planbild auswählen" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" disabled={!!busy} onChange={event => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
              <button type="button" onClick={() => void analyze()} disabled={!file || !!busy} className="min-h-11 cursor-pointer rounded-xl bg-base-dark px-6 text-sm font-black text-white transition-colors hover:bg-accent-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green disabled:cursor-not-allowed disabled:opacity-50">{detection ? 'Erneut analysieren' : '2 · Bild analysieren'}</button>
            </div>
            {busy && <p role="status" className="mt-3 rounded-lg bg-canvas-light p-3 text-sm font-bold">{busy}<span className="ml-2 inline-block animate-pulse" aria-hidden>…</span></p>}
            {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div>}
          </section>

          {detection && options && layout && (
            <>
              <section className="grid gap-4 rounded-xl border border-border-light bg-white p-4 lg:grid-cols-[1fr_auto]" aria-labelledby="image-scale-heading">
                <div>
                  <h3 id="image-scale-heading" className="text-sm font-black">3 · Maßstab und Kapazität festlegen</h3>
                  <p className="mt-1 text-xs leading-relaxed text-base-dark/60">Die Vorlage kann schematisch sein. Zentimeterangaben im Bild werden nicht per OCR übernommen. Tisch- und Bankmaße nach der Übernahme prüfen.</p>
                  <fieldset className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                    <legend className="sr-only">Maßstabsverfahren</legend>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-canvas-light px-3"><input type="radio" name="scale-mode" checked={options.scaleMode === 'table'} disabled={!detection.medianTableLongPx || !!busy} onChange={() => setOptions({ ...options, scaleMode: 'table' })} className="h-4 w-4 accent-accent-green" />Bekannte Garniturlänge</label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-canvas-light px-3"><input type="radio" name="scale-mode" checked={options.scaleMode === 'dimensions'} onChange={() => setOptions({ ...options, scaleMode: 'dimensions', widthCm: layout.widthCm, heightCm: layout.heightCm })} className="h-4 w-4 accent-accent-green" />Gesamtbreite und -höhe</label>
                  </fieldset>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {options.scaleMode === 'table' ? (
                      <label className="text-xs font-bold">Garniturlänge (cm)<NumField min={50} max={500} value={options.tableLengthCm} onCommit={value => setOptions({ ...options, tableLengthCm: value })} className={field} /></label>
                    ) : (
                      <>
                        <label className="text-xs font-bold">Gesamtbreite (cm)<NumField min={100} max={50000} value={options.widthCm} onCommit={value => setOptions({ ...options, widthCm: value })} className={field} /></label>
                        <label className="text-xs font-bold">Gesamthöhe (cm)<NumField min={100} max={50000} value={options.heightCm} onCommit={value => setOptions({ ...options, heightCm: value })} className={field} /></label>
                      </>
                    )}
                    <label className="text-xs font-bold">Personen pro Garnitur<NumField min={1} max={100} value={options.capacity} onCommit={value => setOptions({ ...options, capacity: value })} className={field} /></label>
                    <div className="rounded-lg bg-canvas-light p-3 text-xs font-bold"><span className="block opacity-60">Entwurfsgröße</span><output className="mt-1 block text-sm">{layout.widthCm} × {layout.heightCm} cm</output></div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 self-end text-center lg:w-80">
                  <div className="rounded-lg bg-canvas-light p-3"><dt className="text-xs text-base-dark/60">Garnituren</dt><dd className="text-2xl font-black">{includedTables.length}</dd></div>
                  <div className="rounded-lg bg-canvas-light p-3"><dt className="text-xs text-base-dark/60">Elemente</dt><dd className="text-2xl font-black">{includedCount}</dd></div>
                  <div className="rounded-lg bg-amber-50 p-3"><dt className="text-xs text-amber-900">Zu prüfen</dt><dd className="text-2xl font-black text-amber-900">{reviewCount}</dd></div>
                </dl>
              </section>

              <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <summary className="min-h-11 cursor-pointer font-bold">Hinweise zur Erkennung anzeigen</summary>
                <ul className="list-disc space-y-1 pb-1 pl-5 text-xs leading-relaxed">{detection.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </details>

              <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Original und Entwurfsvorschau">
                <div className="min-w-0 rounded-xl border border-border-light bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black">Original mit Erkennung</h3>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={showOverlay} onChange={event => setShowOverlay(event.target.checked)} className="h-4 w-4 accent-accent-green" />Markierungen</label>
                  </div>
                  <div className="max-h-[58vh] overflow-auto rounded-lg bg-canvas-light">
                    {imageUrl && <div className="relative mx-auto w-full">
                      {/* Lokale Blob-Vorschau; next/image kann Objekt-URLs hier nicht optimieren. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Hochgeladener Zeltplan" className="block h-auto w-full" />
                      {showOverlay && <div className="absolute inset-0" aria-label="Erkannte Objekte im Original">
                        <span className="pointer-events-none absolute border-2 border-base-dark/60" style={{ left: `${detection.frame.x / detection.imageWidth * 100}%`, top: `${detection.frame.y / detection.imageHeight * 100}%`, width: `${detection.frame.w / detection.imageWidth * 100}%`, height: `${detection.frame.h / detection.imageHeight * 100}%` }} />
                        {detection.objects.map(object => {
                          const excluded = options.excludedIds.has(object.id);
                          return <button key={object.id} type="button" disabled={!!busy} aria-pressed={!excluded} aria-label={`${object.label}: ${excluded ? 'ausgeschlossen' : 'übernommen'}. Klicken zum Umschalten.`} onClick={() => toggleObject(object.id)} className={`absolute cursor-pointer border p-0 ${excluded ? 'border-dashed border-red-700 bg-red-500/20' : object.confidence === 'review' ? 'border-amber-400 bg-amber-300/10' : 'border-emerald-500 bg-emerald-300/5'}`} style={{ left: `${object.rect.x / detection.imageWidth * 100}%`, top: `${object.rect.y / detection.imageHeight * 100}%`, width: `${Math.max(.25, object.rect.w / detection.imageWidth * 100)}%`, height: `${Math.max(.2, object.rect.h / detection.imageHeight * 100)}%` }} />;
                        })}
                      </div>}
                    </div>}
                  </div>
                  <p className="mt-2 text-xs text-base-dark/60">Grün: regulärer Treffer · Gelb: prüfen · Rot gestrichelt: ausgeschlossen. Markierung anklicken, um sie umzuschalten.</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border-light bg-white p-3">
                  <h3 className="mb-3 text-sm font-black">Editierbarer Plan-Entwurf</h3>
                  <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg bg-canvas-light p-2"><PlanStaticSvg layout={layout} edit showDims className="h-auto max-h-[58vh] w-full" /></div>
                  <p className="mt-2 text-xs text-base-dark/60">Zeltaußenmaße sind für den Druck aktiviert. Türen, Fluchtwege und weitere Maße ergänzt du nach der Übernahme im Editor.</p>
                </div>
              </section>

              <section className="grid gap-4 rounded-xl border border-border-light bg-white p-4 lg:grid-cols-2" aria-label="Erkannte Elemente korrigieren">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">Bereiche und Bühne benennen</h3><span className="text-xs text-base-dark/60">{otherObjects.length} Treffer</span></div>
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {otherObjects.map(object => <div key={object.id} className="flex items-end gap-2 rounded-lg bg-canvas-light p-2">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-xs font-bold"><input type="checkbox" checked={!options.excludedIds.has(object.id)} disabled={!!busy} onChange={() => toggleObject(object.id)} className="h-4 w-4 accent-accent-green" />Übernehmen</label>
                      <label className="min-w-0 flex-1 text-xs font-bold">{object.kind === 'area' ? 'Bereich' : object.kind === 'stage' ? 'Bühne' : 'Technik'}<input value={options.labels[object.id] ?? object.label} maxLength={80} disabled={!!busy} onChange={event => setOptions({ ...options, labels: { ...options.labels, [object.id]: event.target.value } })} className={field} /></label>
                    </div>)}
                  </div>
                </div>
                <details className="rounded-lg bg-canvas-light p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-black">Garnituren einzeln prüfen ({includedTables.length} von {tables.length})</summary>
                  <button type="button" onClick={toggleTables} disabled={!!busy || !tables.length} className={`${button} mt-2 w-full`}>{includedTables.length === tables.length ? 'Alle Garnituren ausschließen' : 'Alle Garnituren übernehmen'}</button>
                  <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {tables.map(object => <label key={object.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 text-xs font-bold"><input type="checkbox" checked={!options.excludedIds.has(object.id)} disabled={!!busy} onChange={() => toggleObject(object.id)} className="h-4 w-4 shrink-0 accent-accent-green" /><span className="min-w-0 flex-1">{object.label} · {object.vertical ? 'längs' : 'quer'} · {Math.round(object.rect.x)}, {Math.round(object.rect.y)} px</span>{object.confidence === 'review' && <span className="text-amber-800">Prüfen</span>}</label>)}
                  </div>
                </details>
              </section>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-border-light bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-base-dark/60">Noch kein Speichern: Die Übernahme erzeugt eine einzige Undo-fähige Editor-Änderung.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={!!busy} className={button}>Abbrechen</button>
            {detection && <button type="button" onClick={() => void apply()} disabled={!!busy || !includedCount} className="min-h-11 cursor-pointer rounded-xl bg-accent-green px-5 text-sm font-black text-white transition-colors hover:bg-base-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green disabled:cursor-not-allowed disabled:opacity-50">{includedCount} Elemente als Entwurf übernehmen</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
