"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { BadgeCheck, Crown, LinkIcon, Play, Save, Server, ShieldCheck, Twitch, UsersRound, Wifi } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { GuildSummary, ToastKind } from "@/lib/types";
import { Loading } from "./Loading";
import { Toast } from "./Toast";

type SubConfig = {
  guildId: string;
  twitchBroadcasterId?: string;
  twitchBroadcasterName?: string;
  subRoleId?: string;
  logChannelId?: string;
  enabled?: boolean;
  customMessage?: string;
  eventSubSubscriptions?: Array<{ id: string; type: string; status: string }>;
};

type SubStatus = {
  twitchConnected: boolean;
  discordConnected: boolean;
  roleConfigured: boolean;
  eventSubActive: boolean;
  lastSubDetected: string | null;
  lastSubTwitchUsername: string;
  totalSubsRegistered: number;
};

type LinkedAccount = {
  twitchUserId: string;
  twitchUsername: string;
  updatedAt: string;
};

type SubResponse = {
  config: SubConfig | null;
  linkedAccount: LinkedAccount | null;
  status: SubStatus;
};

function StatusCard({ active, label, value, icon: Icon }: { active?: boolean; label: string; value: string; icon: any }) {
  return (
    <article className="rounded-md border border-red-950/70 bg-black/55 p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-red-600/70">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-md border p-2 ${active ? "border-red-500/50 bg-red-500/15 text-red-300" : "border-panel-border bg-panel-surface2 text-panel-muted"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-red-500/15 text-red-300" : "bg-panel-surface2 text-panel-muted"}`}>
          {active ? "Ativo" : "Pendente"}
        </span>
      </div>
      <p className="mt-4 text-sm text-panel-muted">{label}</p>
      <strong className="mt-1 block truncate text-lg text-panel-text">{value}</strong>
    </article>
  );
}

export function SubTwitchPanel({ guildId }: { guildId: string }) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [data, setData] = useState<SubResponse | null>(null);
  const [form, setForm] = useState({
    subRoleId: "",
    logChannelId: "",
    enabled: false,
    customMessage: "Obrigado pelo sub, {twitchUsername}! Cargo entregue no Discord."
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  async function load() {
    const [guildData, subData] = await Promise.all([
      apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`),
      apiFetch<SubResponse>(`/api/twitch/sub/config/${guildId}`)
    ]);

    setGuild(guildData.guild);
    setData(subData);
    setForm({
      subRoleId: subData.config?.subRoleId || "",
      logChannelId: subData.config?.logChannelId || "",
      enabled: Boolean(subData.config?.enabled),
      customMessage: subData.config?.customMessage || "Obrigado pelo sub, {twitchUsername}! Cargo entregue no Discord."
    });
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .catch((error) => alive && setToast({ kind: "error", message: error.message }))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [guildId]);

  useEffect(() => {
    let socket: Socket | null = io({ withCredentials: true });
    socket.on("connect", () => socket?.emit("guild:join", guildId));
    socket.on("twitch:subEvent", () => load().catch(() => null));
    socket.on("twitch:subTest", () => load().catch(() => null));
    socket.on("twitch:subConfigUpdated", () => load().catch(() => null));

    return () => {
      socket?.emit("guild:leave", guildId);
      socket?.disconnect();
      socket = null;
    };
  }, [guildId]);

  const channels = useMemo(() => guild?.channels || [], [guild]);
  const roles = useMemo(() => guild?.roles || [], [guild]);

  function connectTwitch() {
    window.location.href = `/api/auth/twitch?mode=broadcaster&guildId=${guildId}`;
  }

  async function saveConfig() {
    setToast({ kind: "loading", message: "Salvando Cargo Sub Twitch..." });
    try {
      const response = await apiFetch<SubResponse & { message: string }>("/api/twitch/sub/config", {
        method: "POST",
        body: JSON.stringify({ guildId, ...form })
      });
      setData(response);
      setToast({ kind: "success", message: response.message || "Configuracao salva com sucesso" });
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao salvar configuracao" });
    }
  }

  async function testSystem() {
    setToast({ kind: "loading", message: "Testando entrega de cargo..." });
    try {
      const response = await apiFetch<{ message: string }>("/api/twitch/sub/test", {
        method: "POST",
        body: JSON.stringify({ guildId })
      });
      setToast({ kind: "success", message: response.message });
      await load();
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao testar sistema" });
    }
  }

  if (loading) return <Loading label="Carregando Sub Twitch" />;

  const status = data?.status;

  return (
    <section className="space-y-5">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      <div className="rounded-md border border-red-950/70 bg-black p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-red-300">Sistema de Cargo Sub Twitch</p>
            <h2 className="mt-2 text-2xl font-semibold text-panel-text">Sub Twitch</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-panel-muted">
              Detecta subs via Twitch EventSub, encontra a conta vinculada e entrega o cargo no servidor Discord em tempo real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={connectTwitch} className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600">
              <Twitch className="h-4 w-4" />
              Conectar Twitch
            </button>
            <a href="/vincular-conta" className="inline-flex items-center gap-2 rounded-md border border-red-900 bg-panel-bg px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-500">
              <LinkIcon className="h-4 w-4" />
              Vincular Discord + Twitch
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusCard active={status?.twitchConnected} icon={Twitch} label="Twitch conectada" value={data?.config?.twitchBroadcasterName || "Nao conectada"} />
        <StatusCard active={status?.discordConnected} icon={UsersRound} label="Discord conectado" value={guild?.name || "Servidor"} />
        <StatusCard active={status?.roleConfigured} icon={Crown} label="Cargo configurado" value={roles.find((role) => role.id === form.subRoleId)?.name || "Escolha um cargo"} />
        <StatusCard active={status?.eventSubActive} icon={Wifi} label="EventSub ativo" value={`${data?.config?.eventSubSubscriptions?.length || 0} eventos`} />
        <StatusCard active={Boolean(status?.lastSubDetected)} icon={BadgeCheck} label="Ultima sub detectada" value={status?.lastSubTwitchUsername || "Nenhuma"} />
        <StatusCard active={Boolean(status?.totalSubsRegistered)} icon={Server} label="Total de subs registrados" value={String(status?.totalSubsRegistered || 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-red-950/70 bg-black/80 p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-medium text-panel-text">Servidor Discord</span>
              <select disabled value={guildId} className="w-full rounded-md border border-red-950 bg-panel-bg px-3 py-2.5 text-sm text-panel-muted">
                <option value={guildId}>{guild?.name || guildId}</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-panel-text">Cargo que sera entregue para subs</span>
              <select value={form.subRoleId} onChange={(event) => setForm({ ...form, subRoleId: event.target.value })} className="w-full rounded-md border border-red-950 bg-panel-bg px-3 py-2.5 text-sm text-panel-text outline-none focus:border-red-500">
                <option value="">Escolha um cargo</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-panel-text">Canal de logs</span>
              <select value={form.logChannelId} onChange={(event) => setForm({ ...form, logChannelId: event.target.value })} className="w-full rounded-md border border-red-950 bg-panel-bg px-3 py-2.5 text-sm text-panel-text outline-none focus:border-red-500">
                <option value="">Escolha um canal</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-panel-text">Ativar/desativar sistema</span>
              <span className="flex h-11 items-center justify-between rounded-md border border-red-950 bg-panel-bg px-3">
                <span className="text-sm text-panel-muted">{form.enabled ? "Ativado" : "Desativado"}</span>
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-5 w-5 accent-red-600" />
              </span>
            </label>

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-panel-text">Mensagem personalizada</span>
              <textarea value={form.customMessage} rows={5} onChange={(event) => setForm({ ...form, customMessage: event.target.value })} className="w-full rounded-md border border-red-950 bg-panel-bg px-3 py-2.5 text-sm text-panel-text outline-none focus:border-red-500" />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button onClick={testSystem} className="inline-flex items-center gap-2 rounded-md border border-red-900 bg-panel-bg px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-500">
              <Play className="h-4 w-4" />
              Testar Sistema
            </button>
            <button onClick={saveConfig} className="inline-flex items-center gap-2 rounded-md bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600">
              <Save className="h-4 w-4" />
              Salvar Configuracao
            </button>
          </div>
        </div>

        <aside className="rounded-md border border-red-950/70 bg-black p-5 shadow-soft">
          <ShieldCheck className="h-7 w-7 text-red-300" />
          <h3 className="mt-4 text-lg font-semibold">Validacoes ativas</h3>
          <div className="mt-4 space-y-3 text-sm text-panel-muted">
            <p>Bot no servidor, membro presente, cargo existente, permissao Gerenciar Cargos e hierarquia do cargo.</p>
            <p>Conta Twitch do streamer conectada e conta do sub vinculada com Discord.</p>
            <p>Canal de logs validado antes de enviar embed de sucesso ou erro.</p>
          </div>
          <div className="mt-5 rounded-md border border-red-950 bg-panel-bg p-4">
            <p className="text-xs uppercase tracking-wide text-red-300">Conta vinculada</p>
            <strong className="mt-2 block text-panel-text">{data?.linkedAccount?.twitchUsername || "Nenhuma Twitch vinculada neste usuario"}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
