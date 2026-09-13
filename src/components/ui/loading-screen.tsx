export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink-200 border-t-brand-500" />
        <span className="text-[13px] font-medium text-ink-500">{label}…</span>
      </div>
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-[13px] text-ink-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
      {label ?? "Loading…"}
    </div>
  );
}
