export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Wird geladen">
      <p className="text-sm font-bold text-base-dark/60 flex items-center gap-2">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-base-dark/20 border-t-accent-green" aria-hidden />
        Wird geladen …
      </p>
      <div className="h-10 w-64 rounded-xl bg-border-light/60" />
      <div className="h-12 w-full sm:w-96 rounded-xl bg-white border border-border-light" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-white border border-border-light" />
        <div className="h-72 rounded-2xl bg-white border border-border-light" />
      </div>
    </div>
  );
}
