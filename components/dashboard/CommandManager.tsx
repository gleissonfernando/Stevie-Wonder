"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { GuildSummary, ToastKind } from "@/lib/types";
import { Loading } from "./Loading";
import { Toast } from "./Toast";

type CommandItem = {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  requiredPermission: string;
  allowedChannelId: string;
  allowedRoleId: string;
  hiddenWhenDenied: boolean;
};

const permissionOptions = [
  { label: "Nenhuma", value: "" },
  { label: "Administrador", value: "Administrator" },
  { label: "Gerenciar servidor", value: "ManageGuild" },
  { label: "Gerenciar canais", value: "ManageChannels" },
  { label: "Gerenciar cargos", value: "ManageRoles" },
  { label: "Expulsar membros", value: "KickMembers" },
  { label: "Banir membros", value: "BanMembers" },
  { label: "Gerenciar mensagens", value: "ManageMessages" }
];

export function CommandManager({ guildId }: { guildId: string }) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`),
      apiFetch<{ config: { commands: CommandItem[] } }>(`/api/guilds/${guildId}/commands`)
    ])
      .then(([guildData, commandData]) => {
        setGuild(guildData.guild);
        setCommands(commandData.config.commands);
      })
      .catch((error) => setToast({ kind: "error", message: error.message }))
      .finally(() => setLoading(false));
  }, [guildId]);

  const channels = useMemo(() => guild?.channels || [], [guild]);
  const roles = useMemo(() => guild?.roles || [], [guild]);

  function patchCommand(index: number, patch: Partial<CommandItem>) {
    setCommands((current) => current.map((command, itemIndex) => (itemIndex === index ? { ...command, ...patch } : command)));
  }

  async function save() {
    setToast({ kind: "loading", message: "Salvando comandos..." });
    try {
      const data = await apiFetch<{ message: string; config: { commands: CommandItem[] } }>(`/api/guilds/${guildId}/commands`, {
        method: "POST",
        body: JSON.stringify({ commands })
      });
      setCommands(data.config.commands);
      setToast({ kind: "success", message: data.message });
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao salvar comandos" });
    }
  }

  if (loading) return <Loading label="Carregando comandos" />;

  return (
    <section className="space-y-5">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}
      <div className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Sistema de comandos</h2>
            <p className="mt-2 text-sm leading-6 text-panel-muted">Ative, desative e limite comandos por cargo, canal e permissao.</p>
          </div>
          <button onClick={save} className="inline-flex items-center gap-2 rounded-md bg-panel-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
            <Save className="h-4 w-4" />
            Salvar alteracoes
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-panel-border bg-panel-surface shadow-soft">
        <div className="dashboard-scrollbar overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-panel-surface2 text-left text-panel-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Comando</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Permissao</th>
                <th className="px-4 py-3 font-medium">Canal permitido</th>
                <th className="px-4 py-3 font-medium">Cargo permitido</th>
                <th className="px-4 py-3 font-medium">Ocultar</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((command, index) => (
                <tr key={command.name} className="border-t border-panel-border">
                  <td className="px-4 py-3">
                    <strong className="block text-panel-text">/{command.name}</strong>
                    <span className="text-xs text-panel-muted">{command.description}</span>
                  </td>
                  <td className="px-4 py-3 text-panel-muted">{command.category}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={command.enabled}
                      onChange={(event) => patchCommand(index, { enabled: event.target.checked })}
                      className="h-5 w-5 accent-panel-blue"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select value={command.requiredPermission} onChange={(event) => patchCommand(index, { requiredPermission: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-2 py-2 outline-none focus:border-panel-blue">
                      {permissionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={command.allowedChannelId} onChange={(event) => patchCommand(index, { allowedChannelId: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-2 py-2 outline-none focus:border-panel-blue">
                      <option value="">Todos</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={command.allowedRoleId} onChange={(event) => patchCommand(index, { allowedRoleId: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-2 py-2 outline-none focus:border-panel-blue">
                      <option value="">Todos</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={command.hiddenWhenDenied}
                      onChange={(event) => patchCommand(index, { hiddenWhenDenied: event.target.checked })}
                      className="h-5 w-5 accent-panel-blue"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
