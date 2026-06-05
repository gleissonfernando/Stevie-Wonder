import Link from "next/link";
import { ShieldAlert } from "lucide-react";

type ErrorStateProps = {
  title: string;
  message: string;
};

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-md border border-panel-border bg-panel-surface p-8 text-center shadow-soft">
        <ShieldAlert className="mx-auto h-10 w-10 text-panel-red" />
        <h1 className="mt-4 text-2xl font-semibold text-panel-text">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-panel-muted">{message}</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-md bg-panel-blue px-4 py-2 text-sm font-semibold text-white">
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
