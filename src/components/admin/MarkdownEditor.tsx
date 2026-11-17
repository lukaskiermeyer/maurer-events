"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  collapsedByDefault = true,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  collapsedByDefault?: boolean;
  rows?: number;
}) {
  const [open, setOpen] = useState(!collapsedByDefault);
  const [preview, setPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + (selected || "Text") + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newStart = start + before.length;
      const newEnd = newStart + (selected ? selected.length : 4);
      ta.setSelectionRange(newStart, newEnd);
    });
  };

  const formatToolbar = (
    <div className="flex flex-wrap gap-2 mb-2">
      <button type="button" onClick={() => wrapSelection("**", "**")} className="px-3 py-1.5 rounded-lg border border-border-light bg-white text-sm font-bold hover:bg-base-light transition-colors" title="Fett">
        <b>B</b>
      </button>
      <button type="button" onClick={() => wrapSelection("*", "*")} className="px-3 py-1.5 rounded-lg border border-border-light bg-white text-sm italic hover:bg-base-light transition-colors" title="Kursiv">
        <i>I</i>
      </button>
      <button type="button" onClick={() => wrapSelection("\n- ", "")} className="px-3 py-1.5 rounded-lg border border-border-light bg-white text-sm font-bold hover:bg-base-light transition-colors" title="Liste">
        • Liste
      </button>
      <button type="button" onClick={() => wrapSelection("\n## ", "")} className="px-3 py-1.5 rounded-lg border border-border-light bg-white text-sm font-bold hover:bg-base-light transition-colors" title="Überschrift">
        H2
      </button>
    </div>
  );

  const viewToolbar = (
    <div className="flex flex-wrap gap-2 mb-2">
      <button
        type="button"
        onClick={() => setPreview(p => !p)}
        className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${preview ? "bg-accent-green text-white border-accent-green" : "bg-white text-base-dark/60 border-border-light hover:border-accent-green"}`}
      >
        {preview ? "Bearbeiten" : "Vorschau"}
      </button>
      <button type="button" onClick={() => setFullscreen(true)} className="ml-auto px-3 py-1.5 rounded-lg border border-border-light bg-white text-sm font-bold hover:bg-base-light transition-colors">
        ⤢ Vollbild
      </button>
    </div>
  );

  const editor = (full: boolean) => (
    <>
      {full && formatToolbar}
      {viewToolbar}
      {preview ? (
        <div className={`bg-base-light border border-border-light rounded-lg p-3 prose prose-sm max-w-none ${full ? "min-h-[60vh]" : "min-h-[120px]"}`}>
          <ReactMarkdown>{value || "_Keine Beschreibung_"}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={full ? 20 : rows}
          placeholder={placeholder}
          className={`w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green font-mono text-sm ${full ? "min-h-[60vh]" : "min-h-[100px]"}`}
        />
      )}
      <p className="text-xs opacity-50 mt-1">Markdown wird unterstützt (z. B. **fett**, *kursiv*, Listen).</p>
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold mb-1 opacity-70">{label}</label>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-xs font-bold text-accent-green hover:underline"
        >
          {open ? "Einklappen" : "Ausklappen"}
        </button>
      </div>
      {open && editor(false)}

      {!open && value && (
        <p className="text-xs text-base-dark/60 truncate">{value.slice(0, 80)}</p>
      )}

      {fullscreen && (
        <div className="fixed inset-0 z-[200] bg-base-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
              <h2 className="font-display font-bold text-lg">{label} – Vollbild</h2>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="text-base-dark/60 hover:text-base-dark font-bold text-xl leading-none"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {editor(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}