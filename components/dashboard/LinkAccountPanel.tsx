"use client";

import { useEffect, useState } from "react";
import { Bot, LinkIcon, LogIn, Twitch, UserCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { DashboardUser, ToastKind } from "@/lib/types";
import { Toast } from "./Toast";

type LinkStatus = {
  discord: DashboardUser;
  twitch: null | {
    twitchUserId: string;
    twitchUsername: string;
    updatedAt: string;
  };
};

export function LinkAccountPanel() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  useEffect(() => {
    apiFetch<LinkStatus>("/api/link/status")
      .then((data) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function connectTwitch() {
    setToast({ kind: "loading", message: "Abrindo login Twitch..." });
    try {
      const data = await apiFetch<{ url: string }>("/api/link/twitch", { method: "POST" });
      window.location.href = data.url;
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Erro ao conectar Twitch" });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-panel-text">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}
      <section className="w-full max-w-4xl rounded-md border border-red-950 bg-panel-bg p-5 shadow-soft md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-red-300">Sistema de Cargo Sub Twitch</p>
            <h1 className="mt-2 text-3xl font-semibold">Vincular Conta</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-panel-muted">
              Conecte seu Discord e sua Twitch. Quando voce der sub em uma live configurada, o bot encontra esse vinculo e entrega o cargo no servidor.
            </p>
          </div>
          <span className="rounded-md bg-red-700 p-3 text-white">
            <LinkIcon className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-md border border-red-950 bg-black/70 p-5">
            <Bot className="h-7 w-7 text-red-300" />
            <h2 className="mt-4 text-xl font-semibold">Discord</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {loading ? "Verificando sessao..." : status?.discord ? `Conectado como ${status.discord.globalName || status.discord.username}` : "Voce ainda precisa entrar com Discord."}
            </p>
            {status?.discord ? (
              <span className="mt-5 inline-flex items-center gap-2 rounded-md border border-red-900 px-4 py-2 text-sm text-red-100">
                <UserCheck className="h-4 w-4" />
                Discord conectado
              </span>
            ) : (
              <a href="/login" className="mt-5 inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
                <LogIn className="h-4 w-4" />
                Entrar com Discord
              </a>
            )}
          </article>

          <article className="rounded-md border border-red-950 bg-black/70 p-5">
            <Twitch className="h-7 w-7 text-red-300" />
            <h2 className="mt-4 text-xl font-semibold">Twitch</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {status?.twitch ? `Vinculada como ${status.twitch.twitchUsername}` : "Conecte sua conta Twitch para receber cargo de sub automaticamente."}
            </p>
            <button
              type="button"
              onClick={connectTwitch}
              disabled={!status?.discord}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:hover:bg-red-700"
            >
              <Twitch className="h-4 w-4" />
              {status?.twitch ? "Trocar Twitch vinculada" : "Login com Twitch"}
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
