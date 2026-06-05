"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  Command,
  Crown,
  Database,
  HeartHandshake,
  Radio,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  Wifi
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { moduleDefinitions } from "@/lib/modules";
import type { BotStatus, GuildSummary } from "@/lib/types";
import { ConfigCard } from "./ConfigCard";
import { Loading } from "./Loading";
import { MetricCard } from "./MetricCard";
import { StatusPill } from "./StatusPill";

const moduleIcons: Record<string, any> = {
  twitch: Radio,
  welcome: HeartHandshake,
  leave: UsersRound,
  logs: Activity,
  roles: UsersRound,
  verification: ShieldCheck,
  commands: Command,
  appearance: Bell,
  config: SlidersHorizontal
};

export function ServerHome({ guildId }: { guildId: string }) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const configRequests = moduleDefinitions.map((definition) =>
      apiFetch<{ config: Record<string, any> }>(`/api/guilds/${guildId}/${definition.key}`)
        .then((data) => [definition.key, data.config] as const)
        .catch(() => [definition.key, null] as const)
    );

    Promise.all([
      apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`),
      apiFetch<BotStatus>("/api/bot/status"),
      Promise.all(configRequests)
    ])
      .then(([guildData, statusData, configData]) => {
        if (!alive) return;
        setGuild(guildData.guild);
        setStatus(statusData);
        setConfigs(Object.fromEntries(configData));
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [guildId]);

  const activeModules = useMemo(() => Object.values(configs).filter((item: any) => item?.enabled).length, [configs]);

  if (loading) return <Loading label="Carregando home" />;

  return (
    <section className="space-y-6">
      <article className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="rounded-md bg-panel-blue p-3 text-white">
              <Bot className="h-8 w-8" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">Ricardinn98</h2>
                <StatusPill active={status?.online} label={status?.status || "Offline"} />
              </div>
              <p className="mt-2 text-sm text-panel-muted">ID do bot: {status?.clientId || "configure DISCORD_CLIENT_ID"}</p>
              <p className="mt-2 text-sm leading-6 text-panel-muted">Bot Discord e sistema de alertas em tempo real</p>
              <p className="mt-1 text-sm text-panel-muted">Site: https://steviewonder.shardweb.app</p>
            </div>
          </div>
          <Link href={`/dashboard/${guildId}/diagnostic`} className="inline-flex items-center justify-center gap-2 rounded-md bg-panel-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
            <SlidersHorizontal className="h-4 w-4" />
            Diagnosticar
          </Link>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Server} label="Servidores conectados" value={status?.guildCount || 0} detail="Bot presente no Discord" />
        <MetricCard icon={UsersRound} label="Usuarios monitorados" value={status?.userCount || guild?.memberCount || 0} detail={`${guild?.memberCount || 0} neste servidor`} />
        <MetricCard icon={Bell} label="Alertas enviados" value={configs.twitch?.lastMessageId ? 1 : 0} detail="Historico salvo no MongoDB" />
        <MetricCard icon={Command} label="Comandos executados" value={status?.commandCount || 0} detail="Comandos carregados pelo bot" />
        <MetricCard icon={Database} label="Status do MongoDB" value={status?.mongo || "Offline"} />
        <MetricCard icon={Activity} label="Status da API" value={status?.api || "Offline"} />
        <MetricCard icon={Wifi} label="Status do WebSocket" value={status?.websocket || "Offline"} />
        <MetricCard icon={ShieldCheck} label="Modulos ativos" value={activeModules} detail="Configurados por servidor" />
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Modulos rapidos</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ConfigCard
            href={`/dashboard/${guildId}/sub-twitch`}
            icon={Crown}
            title="Sub Twitch"
            description="Entregue cargo automatico quando uma pessoa der sub na live conectada."
            active={Boolean(configs.roles?.twitchSubRoleId)}
          />
          <ConfigCard
            href={`/dashboard/${guildId}/notices`}
            icon={Bell}
            title="Sistema de avisos"
            description="Envie comunicados com embed, imagem, mencao e botao opcional."
            active
          />
          {moduleDefinitions.map((definition) => {
            const Icon = moduleIcons[definition.key] || Activity;
            const config = configs[definition.key];
            return (
              <ConfigCard
                key={definition.key}
                href={`/dashboard/${guildId}/${definition.path}`}
                icon={Icon}
                title={definition.title}
                description={definition.description}
                active={definition.statusField ? Boolean(config?.[definition.statusField]) : Boolean(config)}
              />
            );
          })}
        </div>
      </section>
    </section>
  );
}
