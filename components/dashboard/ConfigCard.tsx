import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { StatusPill } from "./StatusPill";

type ConfigCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  active?: boolean;
};

export function ConfigCard({ href, icon: Icon, title, description, active }: ConfigCardProps) {
  return (
    <article className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-panel-violet/50">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-md border border-panel-border bg-panel-surface2 p-2 text-panel-violet">
          <Icon className="h-5 w-5" />
        </span>
        <StatusPill active={active} label={active ? "Ativado" : "Desativado"} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-panel-text">{title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-panel-muted">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-panel-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Configurar
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
