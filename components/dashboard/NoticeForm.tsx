"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { GuildSummary, ToastKind } from "@/lib/types";
import { Toast } from "./Toast";
import { Loading } from "./Loading";

type NoticeFormProps = {
  guildId: string;
};

export function NoticeForm({ guildId }: NoticeFormProps) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const [form, setForm] = useState({
    channelId: "",
    title: "Aviso",
    description: "",
    imageUrl: "",
    embedColor: "#3b82f6",
    mentionRoleId: "",
    buttonLabel: "",
    buttonUrl: ""
  });

  useEffect(() => {
    apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`)
      .then((data) => setGuild(data.guild))
      .catch((error) => setToast({ kind: "error", message: error.message }))
      .finally(() => setLoading(false));
  }, [guildId]);

  const channels = useMemo(() => guild?.channels || [], [guild]);
  const roles = useMemo(() => guild?.roles || [], [guild]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setToast({ kind: "loading", message: "Enviando aviso..." });

    try {
      const data = await apiFetch<{ message: string }>(`/api/guilds/${guildId}/notices`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      setToast({ kind: "success", message: data.message });
      setForm((current) => ({ ...current, description: "" }));
      window.setTimeout(() => setToast(null), 2600);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao enviar aviso" });
    }
  }

  if (loading) return <Loading label="Carregando canais" />;

  return (
    <section className="space-y-5">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}
      <div className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
        <h2 className="text-2xl font-semibold">Sistema de avisos</h2>
        <p className="mt-2 text-sm leading-6 text-panel-muted">Crie, pre-visualize visualmente pelo formulario e envie avisos no Discord.</p>
      </div>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-medium">Canal onde sera enviado</span>
              <select
                required
                value={form.channelId}
                onChange={(event) => setForm({ ...form, channelId: event.target.value })}
                className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue"
              >
                <option value="">Escolha um canal</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Cargo para mencionar</span>
              <select
                value={form.mentionRoleId}
                onChange={(event) => setForm({ ...form, mentionRoleId: event.target.value })}
                className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue"
              >
                <option value="">Sem mencao</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Titulo do aviso</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Cor do embed</span>
              <input type="color" value={form.embedColor} onChange={(event) => setForm({ ...form, embedColor: event.target.value })} className="h-11 w-full rounded-md border border-panel-border bg-panel-surface2 px-2" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium">Descricao</span>
              <textarea required rows={7} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Imagem por link</span>
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Botao com link opcional</span>
              <input value={form.buttonUrl} onChange={(event) => setForm({ ...form, buttonUrl: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">Texto do botao</span>
              <input value={form.buttonLabel} onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })} className="w-full rounded-md border border-panel-border bg-panel-surface2 px-3 py-2.5 text-sm outline-none focus:border-panel-blue" />
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-panel-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
              <Send className="h-4 w-4" />
              Enviar aviso
            </button>
          </div>
        </div>

        <aside className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft">
          <p className="text-sm font-semibold text-panel-muted">Pre-visualizar</p>
          <div className="mt-4 rounded-md border-l-4 bg-panel-surface2 p-4" style={{ borderLeftColor: form.embedColor }}>
            <h3 className="text-lg font-semibold">{form.title || "Aviso"}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-panel-muted">{form.description || "Descricao do aviso"}</p>
            {form.imageUrl ? <img src={form.imageUrl} alt="" className="mt-4 aspect-video w-full rounded-md object-cover" /> : null}
            {form.buttonLabel && form.buttonUrl ? (
              <span className="mt-4 inline-flex rounded-md bg-panel-blue px-3 py-2 text-sm font-semibold text-white">{form.buttonLabel}</span>
            ) : null}
          </div>
        </aside>
      </form>
    </section>
  );
}
