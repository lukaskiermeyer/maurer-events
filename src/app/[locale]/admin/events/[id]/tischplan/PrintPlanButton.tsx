"use client";

export default function PrintPlanButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-12 inline-flex items-center px-5 bg-base-dark text-white rounded-xl font-bold hover:bg-accent-green transition-colors"
    >
      Drucken / PDF
    </button>
  );
}