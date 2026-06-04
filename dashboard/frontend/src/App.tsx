import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  RadioTower,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Twitch,
  UserRound,
  X,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ViewId = "overview" | "login" | "lives" | "systems" | "security";

type AuthUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

type TwitchConfig = {
  id: string;
  twitchChannelName: string;
  twitchDisplayName?: string;
  twitchAvatarUrl?: string;
  discordChannelId: string;
  enabled: boolean;
  updatedAt: string;
};

type DiscordAlertChannel = {
  id: string;
  name: string;
};

type Metric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "amber" | "red";
};

const apiBase = import.meta.env.VITE_API_URL || "";
const apiPath = (path: string) => `${apiBase}${path}`;
const authPath = (path: string) => apiPath(`/api/auth${path}`);

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Erro ao processar requisicao." }));
    throw new Error(data.error || "Erro ao processar requisicao.");
  }

  return response.json();
}

function relativeTime(value?: string) {
  if (!value) return "sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem registro";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Sidebar({
  activeView,
  open,
  onClose,
  onSelect
}: {
  activeView: ViewId;
  open: boolean;
  onClose: () => void;
  onSelect: (view: ViewId) => void;
}) {
  const items: Array<{ id: ViewId; label: string; icon: LucideIcon; badge?: string }> = [
    { id: "overview", label: "Painel", icon: LayoutDashboard },
    { id: "login", label: "Login", icon: LockKeyhole },
    { id: "lives", label: "Lives", icon: RadioTower, badge: "Twitch" },
    { id: "systems", label: "Sistemas", icon: Server },
    { id: "security", label: "Acesso", icon: ShieldCheck }
  ];

  return (
    <>
      <div className={`sidebar-backdrop ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Bot size={23} />
          </div>
          <div>
            <p className="eyebrow">Steve Wonder</p>
            <h1>Command Center</h1>
          </div>
          <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <div className="server-summary">
          <span>Servidor principal</span>
          <strong>Comunidade Discord</strong>
          <small>Operacao em tempo real</small>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;

            return (
              <button
                className={`nav-item ${active ? "is-active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <span>
                  <Icon size={17} />
                  {item.label}
                </span>
                {item.badge ? <b>{item.badge}</b> : <ChevronRight size={16} />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Sparkles size={18} />
          <div>
            <strong>Dashboard refeito</strong>
            <span>Entrada liberada, sessao monitorada e atalhos prontos.</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  authUser,
  sessionMessage,
  onMenu,
  onOpenLogin,
  onLogout
}: {
  authUser: AuthUser | null;
  sessionMessage: string;
  onMenu: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" type="button" onClick={onMenu} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="eyebrow">Painel do bot</p>
          <span>{sessionMessage}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="search-shell">
          <Search size={16} />
          <input placeholder="Buscar modulo, live ou log" />
        </div>
        <button className="icon-button" type="button" aria-label="Notificacoes">
          <Bell size={17} />
        </button>
        {authUser ? (
          <div className="profile-chip">
            <div>{authUser.avatar ? <img src={authUser.avatar} alt="" /> : <UserRound size={17} />}</div>
            <span>
              <strong>{authUser.username}</strong>
              <small>Sessao Discord</small>
            </span>
            <button className="chip-action" type="button" onClick={onLogout} aria-label="Sair">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="login-pill" type="button" onClick={onOpenLogin}>
            <LogIn size={16} />
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <article className={`metric-card tone-${metric.tone}`}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}

function Overview({
  authUser,
  liveCount,
  enabledLiveCount,
  onOpenLives,
  onOpenSecurity,
  onOpenSystems,
  onLogin
}: {
  authUser: AuthUser | null;
  liveCount: number;
  enabledLiveCount: number;
  onOpenLives: () => void;
  onOpenSecurity: () => void;
  onOpenSystems: () => void;
  onLogin: () => void;
}) {
  const metrics: Metric[] = [
    { label: "Sessao", value: authUser ? "Conectada" : "Livre", detail: authUser ? "Discord validado" : "Painel liberado", icon: ShieldCheck, tone: "green" },
    { label: "Lives", value: String(liveCount), detail: `${enabledLiveCount} alertas ativos`, icon: RadioTower, tone: "blue" },
    { label: "Sistemas", value: "8", detail: "modulos preparados", icon: Gauge, tone: "amber" },
    { label: "Eventos", value: "24h", detail: "monitoramento continuo", icon: Clock3, tone: "red" }
  ];
  const tasks: Array<{ title: string; detail: string; action: string; onClick: () => void }> = [
    {
      title: "Lives da Twitch",
      detail: "Cadastrar canais, ativar alertas e revisar destino no Discord.",
      action: "Abrir",
      onClick: onOpenLives
    },
    {
      title: "Login e permissao",
      detail: "Verificar se o Discord esta autenticado e renovar a sessao.",
      action: "Entrar",
      onClick: onLogin
    },
    {
      title: "Sistemas",
      detail: "Acessar os modulos preparados para o bot e o dashboard.",
      action: "Abrir",
      onClick: onOpenSystems
    },
    {
      title: "Acesso",
      detail: "Conferir o modo liberado e as informacoes da sessao.",
      action: "Checar",
      onClick: onOpenSecurity
    }
  ];

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="status-pill">
            <i />
            Online
          </div>
          <h2>Controle completo do Steve Wonder</h2>
          <p>
            Gerencie lives, sistemas, acesso e operacao do bot em uma tela direta, sem bloqueio visual quando a
            sessao Discord estiver instavel.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={onOpenLives}>
              <Twitch size={17} />
              Configurar lives
            </button>
            <button className="ghost-action" type="button" onClick={onLogin}>
              <LogIn size={17} />
              Vincular Discord
            </button>
          </div>
        </div>

        <div className="visual-panel" aria-hidden="true">
          <div className="orbit-card">
            <Bot size={38} />
            <span>Steve Wonder</span>
          </div>
          <div className="signal-row">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="work-grid">
        <article className="wide-card">
          <div className="section-title">
            <Activity size={20} />
            <div>
              <h3>Fluxo principal</h3>
              <span>Operacoes mais usadas do painel</span>
            </div>
          </div>
          {tasks.map((task) => (
            <div className="task-row" key={task.title}>
              <div>
                <strong>{task.title}</strong>
                <span>{task.detail}</span>
              </div>
              <button className="row-action" type="button" onClick={task.onClick}>{task.action}</button>
            </div>
          ))}
        </article>

        <article className="info-card">
          <div className="section-title">
            <Zap size={20} />
            <div>
              <h3>Estado</h3>
              <span>Resumo rapido</span>
            </div>
          </div>
          <div className="health-list">
            <span><CheckCircle2 size={16} /> Frontend TSX ativo</span>
            <span><CheckCircle2 size={16} /> Entrada do painel liberada</span>
            <span><CircleAlert size={16} /> OAuth monitorado</span>
          </div>
        </article>
      </section>
    </>
  );
}

function LoginView({
  authUser,
  sessionMessage,
  onLogin,
  onLogout,
  onRefresh
}: {
  authUser: AuthUser | null;
  sessionMessage: string;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const steps = [
    ["1", "Entrar com Discord", "Abre o OAuth oficial e volta para o dashboard."],
    ["2", "Salvar sessao", "O backend cria o cookie seguro do painel."],
    ["3", "Liberar dashboard", "A interface atualiza o usuario e habilita os recursos protegidos."]
  ];

  return (
    <section className="view-stack">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Login</p>
          <h2>Acesso ao dashboard</h2>
          <span>{sessionMessage}</span>
        </div>
        <button className="ghost-action" type="button" onClick={onRefresh}>
          <RefreshCw size={17} />
          Verificar sessao
        </button>
      </div>

      <div className="login-grid">
        <article className="login-card primary-login-card">
          <div className="login-badge">
            {authUser ? <CheckCircle2 size={22} /> : <LockKeyhole size={22} />}
          </div>
          <p className="eyebrow">Conta Discord</p>
          <h3>{authUser ? authUser.username : "Nenhuma sessao ativa"}</h3>
          <p>
            {authUser
              ? "Sua conta Discord foi reconhecida pelo painel. Voce pode sair e entrar novamente quando quiser."
              : "Entre com Discord para vincular sua conta ao painel. O dashboard permanece visivel mesmo sem login."}
          </p>
          <div className="login-actions">
            <button className="primary-action" type="button" onClick={onLogin}>
              <LogIn size={17} />
              Entrar com Discord
            </button>
            {authUser ? (
              <button className="ghost-action" type="button" onClick={onLogout}>
                <LogOut size={17} />
                Sair
              </button>
            ) : null}
          </div>
        </article>

        <article className="login-card">
          <div className="section-title">
            <ShieldCheck size={20} />
            <div>
              <h3>Sistema de acesso</h3>
              <span>Fluxo usado pelo dashboard</span>
            </div>
          </div>
          <div className="login-steps">
            {steps.map(([number, title, detail]) => (
              <div className="login-step" key={title}>
                <b>{number}</b>
                <div>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function LivesView({
  configs,
  channels,
  loading,
  error,
  onRefresh
}: {
  configs: TwitchConfig[];
  channels: DiscordAlertChannel[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  function channelName(id: string) {
    const channel = channels.find((item) => item.id === id);
    return channel ? `#${channel.name}` : id || "canal nao definido";
  }

  return (
    <section className="view-stack">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Social notifications</p>
          <h2>Lives da Twitch</h2>
          <span>Cadastros e alertas conectados ao Discord.</span>
        </div>
        <button className="ghost-action" type="button" onClick={onRefresh}>
          <RefreshCw size={17} />
          Atualizar
        </button>
      </div>

      {error ? <div className="notice-error">{error}</div> : null}

      <div className="live-list">
        {loading ? (
          <article className="empty-card">Carregando configuracoes de live...</article>
        ) : configs.length ? (
          configs.map((config) => (
            <article className="live-card" key={config.id}>
              <div className="live-avatar">
                {config.twitchAvatarUrl ? <img src={config.twitchAvatarUrl} alt="" /> : <Twitch size={22} />}
              </div>
              <div>
                <strong>@{config.twitchDisplayName || config.twitchChannelName}</strong>
                <span>{channelName(config.discordChannelId)}</span>
                <small>Atualizado em {relativeTime(config.updatedAt)}</small>
              </div>
              <b className={config.enabled ? "is-enabled" : ""}>{config.enabled ? "Ativo" : "Pausado"}</b>
            </article>
          ))
        ) : (
          <article className="empty-card">
            Nenhum canal Twitch cadastrado ainda. Use as rotas do backend ou conecte o Discord para administrar os
            alertas.
          </article>
        )}
      </div>
    </section>
  );
}

function SystemsView() {
  const systems = [
    ["Boas-vindas", "Mensagens e GIF de entrada", "Pronto"],
    ["Logs", "Eventos de servidor e auditoria", "Ativo"],
    ["Economia", "Comandos de saldo e perfil", "Base"],
    ["Tempo real", "Acoes via socket para o bot", "Preparado"]
  ];

  return (
    <section className="view-stack">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Modulos</p>
          <h2>Sistemas do bot</h2>
          <span>Mapa operacional para evoluir o painel.</span>
        </div>
      </div>
      <div className="system-grid">
        {systems.map(([title, detail, state]) => (
          <article className="system-card" key={title}>
            <Server size={21} />
            <strong>{title}</strong>
            <span>{detail}</span>
            <b>{state}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function SecurityView({ authUser, sessionMessage }: { authUser: AuthUser | null; sessionMessage: string }) {
  return (
    <section className="view-stack">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Acesso</p>
          <h2>Sessao e permissao</h2>
          <span>{sessionMessage}</span>
        </div>
      </div>
      <div className="security-card">
        <ShieldCheck size={28} />
        <div>
          <strong>{authUser ? `Logado como ${authUser.username}` : "Painel em modo livre"}</strong>
          <p>
            O dashboard nao bloqueia mais a interface quando o OAuth nao retorna sessao. O login Discord continua
            disponivel para recursos protegidos do backend.
          </p>
        </div>
        <a className="primary-action" href={authPath("/discord")}>
          <LogIn size={17} />
          Entrar com Discord
        </a>
      </div>
    </section>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState("Painel liberado");
  const [configs, setConfigs] = useState<TwitchConfig[]>([]);
  const [channels, setChannels] = useState<DiscordAlertChannel[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");

  const enabledLiveCount = useMemo(() => configs.filter((config) => config.enabled).length, [configs]);

  async function loadSession() {
    try {
      const data = await requestJson<{ user: AuthUser }>("/api/auth/me", { cache: "no-store" });
      setAuthUser(data.user);
      setSessionMessage(`Sessao ativa para ${data.user.username}`);
    } catch (error) {
      setAuthUser(null);
      setSessionMessage(error instanceof Error ? error.message : "Painel liberado sem sessao Discord");
    }
  }

  async function loadLives() {
    setLiveLoading(true);
    setLiveError("");

    try {
      const [liveData, channelData] = await Promise.all([
        requestJson<{ twitch: TwitchConfig[] }>("/api/lives"),
        requestJson<{ channels: DiscordAlertChannel[] }>("/api/lives/channels")
      ]);
      setConfigs(liveData.twitch || []);
      setChannels(channelData.channels || []);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Nao foi possivel carregar as lives.");
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    loadLives();
  }, []);

  async function logout() {
    await fetch(authPath("/logout"), { method: "POST", credentials: "include" }).catch(() => null);
    setAuthUser(null);
    setSessionMessage("Painel liberado");
  }

  return (
    <main className="app-shell">
      <Sidebar
        activeView={activeView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={setActiveView}
      />
      <section className="main-panel">
        <Topbar
          authUser={authUser}
          sessionMessage={sessionMessage}
          onMenu={() => setSidebarOpen(true)}
          onOpenLogin={() => setActiveView("login")}
          onLogout={logout}
        />
        <div className="content">
          {activeView === "overview" ? (
            <Overview
              authUser={authUser}
              liveCount={configs.length}
              enabledLiveCount={enabledLiveCount}
              onOpenLives={() => setActiveView("lives")}
              onOpenSecurity={() => setActiveView("security")}
              onOpenSystems={() => setActiveView("systems")}
              onLogin={() => {
                setActiveView("login");
              }}
            />
          ) : null}
          {activeView === "login" ? (
            <LoginView
              authUser={authUser}
              sessionMessage={sessionMessage}
              onLogin={() => {
                window.location.href = authPath("/discord");
              }}
              onLogout={logout}
              onRefresh={loadSession}
            />
          ) : null}
          {activeView === "lives" ? (
            <LivesView configs={configs} channels={channels} loading={liveLoading} error={liveError} onRefresh={loadLives} />
          ) : null}
          {activeView === "systems" ? <SystemsView /> : null}
          {activeView === "security" ? <SecurityView authUser={authUser} sessionMessage={sessionMessage} /> : null}
        </div>
      </section>
    </main>
  );
}
