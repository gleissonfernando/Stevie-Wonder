type StatusPillProps = {
  active?: boolean;
  label: string;
};

export function StatusPill({ active, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-panel-green/40 bg-panel-green/15 text-panel-green"
          : "border-panel-border bg-panel-surface2 text-panel-muted"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-panel-green" : "bg-panel-muted"}`} />
      {label}
    </span>
  );
}
