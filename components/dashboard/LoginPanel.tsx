"use client";

import { useEffect, useState } from "react";
import { Bot, LogIn, Radio, ShieldCheck, Wifi } from "lucide-react";
import { loginWithDiscord } from "@/lib/api";
import type { BotStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { StatusPill } from "./StatusPill";

export function LoginPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<BotStatus>("/api/bot/status")
      .then((data) => setStatus(data))
      .catch(() => null);
  }, []);

  async function login() {
    setLoading(true);
    setError("");
    try {
      await loginWithDiscord();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar login Discord.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-panel-text">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-md border border-panel-border bg-panel-surface p-6 shadow-soft md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-3 rounded-md border border-panel-border bg-panel-surface2 px-4 py-3">
              <span className="rounded-md bg-panel-blue p-2 text-white">
                <Bot className="h-5 w-5" />
              </span>
              <span>
                <strong className="block">Ricardinn98 Dashboard</strong>
                <span className="text-xs text-panel-muted">Bot Discord e sistema de alertas em tempo real</span>
              </span>
            </span>
            <StatusPill active={status?.online} label={status?.status || "Offline"} />
          </div>

          <div className="mt-8 max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Ricardinn98 Dashboard</h1>
            <p className="mt-4 text-sm leading-7 text-panel-muted">
              Painel de gerenciamento do bot Discord para configurar servidores, alertas de live, cargos,
              mensagens, logs, comandos e modulos em tempo real.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-panel-border bg-panel-surface2 p-4">
              <Wifi className="h-5 w-5 text-panel-blue" />
              <strong className="mt-3 block">WebSocket</strong>
              <span className="text-sm text-panel-muted">{status?.websocket || "Aguardando cliente"}</span>
            </div>
            <div className="rounded-md border border-panel-border bg-panel-surface2 p-4">
              <Radio className="h-5 w-5 text-panel-violet" />
              <strong className="mt-3 block">Alertas</strong>
              <span className="text-sm text-panel-muted">Tempo real</span>
            </div>
            <div className="rounded-md border border-panel-border bg-panel-surface2 p-4">
              <ShieldCheck className="h-5 w-5 text-panel-green" />
              <strong className="mt-3 block">OAuth2</strong>
              <span className="text-sm text-panel-muted">Discord seguro</span>
            </div>
          </div>

          <button
            type="button"
            onClick={login}
            disabled={loading}
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-panel-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:hover:bg-panel-blue"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar com Discord"}
          </button>
          {error ? <p className="mt-4 text-sm text-panel-red">{error}</p> : null}
        </div>

        <aside className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
          <img src="/assets/welcome.gif" alt="" className="aspect-video w-full rounded-md object-cover" />
          <div className="mt-5 space-y-3 text-sm text-panel-muted">
            <p>Status do bot, MongoDB, API e WebSocket aparecem no dashboard depois do login.</p>
            <p>O acesso so libera servidor onde voce e dono, admin ou tem cargo administrador do painel.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
