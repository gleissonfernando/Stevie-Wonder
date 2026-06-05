"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, LogOut, Server } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DashboardUser, GuildSummary } from "@/lib/types";
import { Loading } from "./Loading";

export function GuildSelector() {
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<{ user: DashboardUser }>("/api/auth/me"),
      apiFetch<{ guilds: GuildSummary[] }>("/api/guilds")
    ])
      .then(([userData, guildData]) => {
        setUser(userData.user);
        setGuilds(guildData.guilds);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Sessao expirada."))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 text-panel-text">
        <Loading label="Buscando servidores" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-panel-text">
        <section className="rounded-md border border-panel-border bg-panel-surface p-8 text-center shadow-soft">
          <h1 className="text-2xl font-semibold">Erro de autenticacao</h1>
          <p className="mt-3 text-sm text-panel-muted">{error}</p>
          <Link href="/login" className="mt-6 inline-flex rounded-md bg-panel-blue px-4 py-2 text-sm font-semibold text-white">
            Entrar novamente
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 text-panel-text md:px-8">
      <header className="mx-auto flex max-w-6xl flex-col gap-4 rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-panel-blue p-2 text-white">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Escolha um servidor</h1>
            <p className="text-sm text-panel-muted">Ricardinn98 Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-full" /> : null}
          <span className="text-sm text-panel-muted">{user?.globalName || user?.username}</span>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-md border border-panel-border px-3 py-2 text-sm text-panel-muted hover:text-panel-text">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <section className="mx-auto mt-6 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
        {guilds.map((guild) => (
          <article key={guild.id} className="rounded-md border border-panel-border bg-panel-surface p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-panel-blue/50">
            <div className="flex items-start gap-4">
              {guild.icon ? (
                <img src={guild.icon} alt="" className="h-14 w-14 rounded-md object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-md bg-panel-surface2">
                  <Server className="h-6 w-6 text-panel-blue" />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{guild.name}</h2>
                <p className="mt-1 text-xs text-panel-muted">ID {guild.id}</p>
                <p className="mt-2 text-sm text-panel-muted">{guild.memberCount} membros</p>
              </div>
            </div>
            <Link href={`/dashboard/${guild.id}/home`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-panel-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
              Gerenciar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </section>

      {!guilds.length ? (
        <section className="mx-auto mt-6 max-w-3xl rounded-md border border-panel-border bg-panel-surface p-8 text-center shadow-soft">
          <h2 className="text-xl font-semibold">Nenhum servidor disponivel</h2>
          <p className="mt-3 text-sm leading-6 text-panel-muted">
            Voce precisa ser dono, administrador ou ter um cargo configurado como administrador do painel em um servidor onde o bot esteja presente.
          </p>
        </section>
      ) : null}
    </main>
  );
}
