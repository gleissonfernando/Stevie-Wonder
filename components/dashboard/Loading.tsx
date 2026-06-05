import { Loader2 } from "lucide-react";

export function Loading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-md border border-panel-border bg-panel-surface">
      <div className="flex items-center gap-3 text-sm text-panel-muted">
        <Loader2 className="h-5 w-5 animate-spin text-panel-blue" />
        {label}
      </div>
    </div>
  );
}
