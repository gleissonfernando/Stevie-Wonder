import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
};

export function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <article className="rounded-md border border-panel-border bg-panel-surface p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-panel-blue/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-panel-muted">{label}</p>
          <strong className="mt-2 block text-2xl text-panel-text">{value}</strong>
        </div>
        <span className="rounded-md border border-panel-border bg-panel-surface2 p-2 text-panel-blue">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {detail ? <p className="mt-3 text-xs text-panel-muted">{detail}</p> : null}
    </article>
  );
}
