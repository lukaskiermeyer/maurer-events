"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-block bg-accent-green text-white px-5 py-3 rounded-xl font-bold"
    >
      Drucken
    </button>
  );
}