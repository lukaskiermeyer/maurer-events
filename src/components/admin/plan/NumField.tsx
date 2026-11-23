"use client";

import { useEffect, useRef, useState } from "react";

// Zahlenfeld mit lokalem Tipp-Zustand: Commit erst bei Blur/Enter, damit
// Zwischenstände ("", "1", "12") nicht sofort geklemmt/überschrieben werden.
export default function NumField({ value, onCommit, min, max, step, className, ariaLabel }: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  // blur() feuert synchron im Keydown-Handler; ohne Flag würde onBlur erneut committen.
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseFloat(text.replace(",", "."));
    let v = Number.isFinite(parsed) ? parsed : value;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    v = Math.round(v);
    setText(String(v));
    if (v !== value) onCommit(v);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      step={step}
      min={min}
      max={max}
      className={className}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (skipBlurCommit.current) { skipBlurCommit.current = false; return; }
        commit();
      }}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); commit(); skipBlurCommit.current = true; (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { skipBlurCommit.current = true; setText(String(value)); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}