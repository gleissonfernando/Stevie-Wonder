"use client";

import { useEffect, useState } from "react";
import { Activity, Database, RefreshCw, Server, Wifi, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { BotStatus } from "@/lib/types";
import { Loading } from "./Loading";
import { MetricCard } from "./MetricCard";
import { Toast } from "./Toast";

type Diagnostic = {
  status: BotStatus;
  diagnostic: {
    bot: string;
    botPing: number;
    apiPing: number;
    mongo: string;
    websocket: string;
    lastConnection: string;
    lastError: string | null;
    version: string;
    activeEvents: number;
  };
};

export function DiagnosticPanel({ guildId }: { guildId: string }) {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    const started = performance.now();
    setLoading(true);
    try {
      const response = await apiFetch<Diagnostic>(`/api/guilds/${guildId}/diagnostic`);
      response.diagnostic.apiPing = Math.round(performance.now() - started);
      setData(response);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [guildId]);

  async function test(label: string) {
    await load();
    setToast(`${label} testado com sucesso`);
    window.setTimeout(() => setToast(null), 2200);
  }

  if (loading && !data) return <Loading label="Carregando diagnostico" />;

  return (
    <section className="space-y-5">
      {toast ? <Toast kind="success" message={toast} /> : null}
      <div className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Diagnosticar</h2>
            <p className="mt-2 text-sm text-panel-muted">Status do bot, API, MongoDB e WebSocket.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-panel-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
            <RefreshCw className="h-4 w-4" />
            Recarregar configuracoes
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Server} label="Status do bot" value={data?.diagnostic.bot || "Offline"} detail={`Ping ${data?.diagnostic.botPing || 0}ms`} />
        <MetricCard icon={Zap} label="Ping da API" value={`${data?.diagnostic.apiPing || 0}ms`} />
        <MetricCard icon={Database} label="Status do MongoDB" value={data?.diagnostic.mongo || "Offline"} />
        <MetricCard icon={Wifi} label="Status do WebSocket" value={data?.diagnostic.websocket || "Offline"} />
        <MetricCard icon={Activity} label="Ultima conexao" value={data?.diagnostic.lastConnection ? new Date(data.diagnostic.lastConnection).toLocaleTimeString("pt-BR") : "-"} />
        <MetricCard icon={Activity} label="Ultimo erro" value={data?.diagnostic.lastError || "Nenhum"} />
        <MetricCard icon={Activity} label="Versao do sistema" value={data?.diagnostic.version || "1.0.0"} />
        <MetricCard icon={Activity} label="Eventos ativos" value={data?.diagnostic.activeEvents || 0} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => test("Conexao com bot")} className="rounded-md border border-panel-border bg-panel-surface px-4 py-2 text-sm font-semibold text-panel-text hover:border-panel-blue">
          Testar conexao com bot
        </button>
        <button onClick={() => test("MongoDB")} className="rounded-md border border-panel-border bg-panel-surface px-4 py-2 text-sm font-semibold text-panel-text hover:border-panel-blue">
          Testar MongoDB
        </button>
        <button onClick={() => test("WebSocket")} className="rounded-md border border-panel-border bg-panel-surface px-4 py-2 text-sm font-semibold text-panel-text hover:border-panel-blue">
          Testar WebSocket
        </button>
      </div>
    </section>
  );
}
