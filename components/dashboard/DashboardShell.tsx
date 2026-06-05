"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  Activity,
  Bell,
  Bot,
  Command,
  Crown,
  DoorOpen,
  HeartHandshake,
  Home,
  LogOut,
  Palette,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { BotStatus, DashboardUser, GuildSummary } from "@/lib/types";
import { StatusPill } from "./StatusPill";

type DashboardShellProps = {
  guildId: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "home", label: "Home", icon: Home },
  { href: "twitch", label: "Lives", icon: Radio },
  { href: "sub-twitch", label: "Sub Twitch", icon: Crown },
  { href: "welcome", label: "Boas-vindas", icon: HeartHandshake },
  { href: "leave", label: "Saidas", icon: DoorOpen },
  { href: "logs", label: "Logs", icon: Activity },
  { href: "roles", label: "Cargos", icon: UsersRound },
  { href: "verification", label: "Verificacao", icon: ShieldCheck },
  { href: "notices", label: "Avisos", icon: Bell },
  { href: "commands", label: "Comandos", icon: Command },
  { href: "appearance", label: "Aparencia", icon: Palette },
  { href: "settings", label: "Configuracoes", icon: Settings },
  { href: "diagnostic", label: "Diagnosticar", icon: SlidersHorizontal }
];

export function DashboardShell({ guildId, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);

  useEffect(() => {
    let alive = true;

    apiFetch<{ user: DashboardUser }>("/api/auth/me")
      .then((data) => alive && setUser(data.user))
      .catch(() => router.push("/login"));

    apiFetch<{ guild: GuildSummary }>(`/api/guilds/${guildId}`)
      .then((data) => alive && setGuild(data.guild))
      .catch(() => router.push("/dashboard"));

    apiFetch<BotStatus>("/api/bot/status")
      .then((data) => alive && setStatus(data))
      .catch(() => null);

    return () => {
      alive = false;
    };
  }, [guildId, router]);

  useEffect(() => {
    let socket: Socket | null = io({ withCredentials: true });

    socket.on("connect", () => {
      socket?.emit("guild:join", guildId);
    });

    socket.on("bot:status", (data: BotStatus) => setStatus(data));
    socket.on("bot:ping", (data: { ping: number }) => {
      setStatus((current) => (current ? { ...current, ping: data.ping } : current));
    });

    return () => {
      socket?.emit("guild:leave", guildId);
      socket?.disconnect();
      socket = null;
    };
  }, [guildId]);

  const currentSection = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "home";
  }, [pathname]);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
  }

  return (
    <div className="min-h-screen text-panel-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-panel-border bg-panel-bg/95 px-4 py-5 backdrop-blur lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-md border border-panel-border bg-panel-surface px-4 py-3">
          <span className="rounded-md bg-panel-blue p-2 text-white">
            <Bot className="h-5 w-5" />
          </span>
          <span>
            <strong className="block text-sm">Ricardinn98 Dashboard</strong>
            <span className="text-xs text-panel-muted">Painel do bot Discord</span>
          </span>
        </Link>

        <nav className="dashboard-scrollbar mt-5 flex max-h-[calc(100vh-170px)] flex-col gap-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentSection === item.href;

            return (
              <Link
                key={item.href}
                href={`/dashboard/${guildId}/${item.href}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-panel-blue text-white"
                    : "text-panel-muted hover:bg-panel-surface hover:text-panel-text"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-md border border-panel-border bg-panel-surface px-3 py-2 text-sm text-panel-muted transition hover:text-panel-text"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-panel-border bg-panel-bg/88 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {guild?.icon ? (
                <img src={guild.icon} alt="" className="h-11 w-11 rounded-md object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-panel-surface text-sm font-bold">
                  {guild?.name?.slice(0, 2).toUpperCase() || "R"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-panel-muted">Servidor selecionado</p>
                <h1 className="truncate text-xl font-semibold">{guild?.name || "Carregando servidor"}</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill active={status?.online} label={status?.status || "Offline"} />
              <span className="rounded-full border border-panel-border bg-panel-surface px-3 py-1 text-xs text-panel-muted">
                Ping {status?.ping ?? 0}ms
              </span>
              <span className="rounded-full border border-panel-border bg-panel-surface px-3 py-1 text-xs text-panel-muted">
                Uptime {status?.uptime || "0m"}
              </span>
              {user?.avatar ? <img src={user.avatar} alt="" className="h-8 w-8 rounded-full" /> : null}
            </div>
          </div>

          <nav className="dashboard-scrollbar mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentSection === item.href;
              return (
                <Link
                  key={item.href}
                  href={`/dashboard/${guildId}/${item.href}`}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    active ? "bg-panel-blue text-white" : "bg-panel-surface text-panel-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
