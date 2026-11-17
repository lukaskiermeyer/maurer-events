"use client";

import { useTransition } from "react";

export interface ChanceStatusOption {
  value: string;
  label: string;
}

export default function ChanceStatusSelect({
  value,
  options,
  action,
  label,
}: {
  value: string;
  options: ChanceStatusOption[];
  action: (next: string) => Promise<unknown>;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      key={value}
      aria-label={label}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await action(next);
        });
      }}
      className="min-h-9 max-w-[160px] rounded-lg border border-border-light bg-white px-2 py-1 text-xs font-bold text-base-dark/70 hover:border-accent-green focus:border-accent-green focus:outline-none disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
