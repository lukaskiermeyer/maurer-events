export default function TeamLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Wird geladen">
      <p className="text-sm font-bold text-base-dark/60 flex items-center gap-2">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-base-dark/20 border-t-accent-green" aria-hidden />
        Wird geladen …
      </p>
      <div className="h-10 w-64 rounded-xl bg-border-light/60" />
      <div className="h-6 w-96 max-w-full rounded-lg bg-border-light/60" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 rounded-2xl bg-white border border-border-light" />
        <div className="h-28 rounded-2xl bg-white border border-border-light" />
      </div>
      <div className="h-40 rounded-2xl bg-white border border-border-light" />
    </div>
  );
}
