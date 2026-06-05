"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { RefreshCw, Save, Send, TestTube2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { GuildSummary, ModuleDefinition, ToastKind } from "@/lib/types";
import { Toast } from "./Toast";
import { Loading } from "./Loading";

type ModuleFormProps = {
  definition: ModuleDefinition;
  guildId: string;
};

function getNestedValue(source: any, path: string) {
  const value = path.split(".").reduce((current, key) => current?.[key], source);
  if (Array.isArray(value)) return value[0] || "";
  return value ?? "";
}

function normalizePayload(payload: Record<string, any>) {
  if (typeof payload.adminRoles === "string") {
    payload.adminRoles = payload.adminRoles ? [payload.adminRoles] : [];
  }

  return payload;
}

export function ModuleForm({ definition, guildId }: ModuleFormProps) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const { register, reset, handleSubmit, watch } = useForm<Record<string, any>>();
  const watched = watch();

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`),
      apiFetch<{ config: Record<string, any> }>(`/api/guilds/${guildId}/${definition.key}`)
    ])
      .then(([guildData, configData]) => {
        if (!alive) return;
        setGuild(guildData.guild);
        reset(configData.config);
      })
      .catch((error) => {
        if (alive) setToast({ kind: "error", message: error.message });
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [definition.key, guildId, reset]);

  const channels = useMemo(() => guild?.channels || [], [guild]);
  const roles = useMemo(() => guild?.roles || [], [guild]);

  async function submit(values: Record<string, any>) {
    setToast({ kind: "loading", message: "Salvando configuracao..." });

    try {
      const data = await apiFetch<{ message: string; config: Record<string, any> }>(`/api/guilds/${guildId}/${definition.key}`, {
        method: "POST",
        body: JSON.stringify(normalizePayload(values))
      });
      reset(data.config);
      setToast({ kind: "success", message: data.message || "Configuracao salva com sucesso" });
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao salvar configuracao" });
    }
  }

  async function testAlert() {
    setToast({ kind: "loading", message: "Enviando alerta de teste..." });
    try {
      const data = await apiFetch<{ message: string }>(`/api/guilds/${guildId}/twitch/test`, { method: "POST" });
      setToast({ kind: "success", message: data.message });
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao testar alerta" });
    }
  }

  async function publishVerification() {
    setToast({ kind: "loading", message: "Publicando painel..." });
    try {
      const data = await apiFetch<{ message: string }>(`/api/guilds/${guildId}/verification/publish`, { method: "POST" });
      setToast({ kind: "success", message: data.message });
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao publicar painel" });
    }
  }

  if (loading) return <Loading label="Carregando configuracao" />;

  return (
    <section className="space-y-5">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      <div className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{definition.title}</h2>
            <p className="mt-2 text-sm leading-6 text-panel-muted">{definition.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {definition.key === "twitch" ? (
              <button
                type="button"
                onClick={testAlert}
                className="inline-flex items-center gap-2 rounded-md border border-panel-border bg-panel-surface2 px-4 py-2 text-sm font-semibold text-panel-text transition hover:border-panel-blue"
              >
                <TestTube2 className="h-4 w-4" />
                Testar alerta
              </button>
            ) : null}
            {definition.key === "verification" ? (
              <button
                type="button"
                onClick={publishVerification}
                className="inline-flex items-center gap-2 rounded-md border border-panel-border bg-panel-surface2 px-4 py-2 text-sm font-semibold text-panel-text transition hover:border-panel-blue"
              >
                <Send className="h-4 w-4" />
                Publicar painel
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-md border border-panel-border bg-panel-surface2 px-4 py-2 text-sm font-semibold text-panel-muted transition hover:text-panel-text"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(submit)} className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          {definition.fields.map((field) => {
            const value = getNestedValue(watched, field.name);
            const commonClass =
              "w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm text-panel-text outline-none transition focus:border-panel-blue";

            return (
              <label key={field.name} className={field.kind === "textarea" ? "md:col-span-2" : ""}>
                <span className="mb-2 block text-sm font-medium text-panel-text">{field.label}</span>

                {field.kind === "textarea" ? (
                  <textarea rows={5} placeholder={field.placeholder} className={commonClass} {...register(field.name)} />
                ) : field.kind === "toggle" ? (
                  <span className="flex h-11 items-center justify-between rounded-md border border-panel-border bg-panel-surface2 px-3">
                    <span className="text-sm text-panel-muted">{value ? "Ativado" : "Desativado"}</span>
                    <input type="checkbox" className="h-5 w-5 accent-panel-blue" {...register(field.name)} />
                  </span>
                ) : field.kind === "channel" ? (
                  <select className={commonClass} {...register(field.name)}>
                    <option value="">Escolha um canal</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "role" ? (
                  <select className={commonClass} {...register(field.name)}>
                    <option value="">Escolha um cargo</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "select" ? (
                  <select className={commonClass} {...register(field.name)}>
                    {(field.options || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.kind === "number" ? "number" : field.kind}
                    placeholder={field.placeholder}
                    className={commonClass}
                    {...register(field.name, field.kind === "number" ? { valueAsNumber: true } : undefined)}
                  />
                )}
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-panel-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Save className="h-4 w-4" />
            Salvar alteracoes
          </button>
        </div>
      </form>
    </section>
  );
}
