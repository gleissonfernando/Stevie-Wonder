import {
  Activity,
  Bell,
  Bot,
  ChevronRight,
  FileClock,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Paintbrush,
  Plug,
  Plus,
  RadioTower,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare,
  Trash2,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { FaTiktok, FaTwitch, FaYoutube } from "react-icons/fa";
import { io, type Socket } from "socket.io-client";

type ViewId = "dashboard" | "lives";

type NavItem = {
  id: ViewId | "settings" | "permissions" | "modules" | "logs" | "custom";
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type ConfigCard = {
  category: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  badge?: string;
};

type TwitchConfig = {
  id: string;
  twitchChannelName: string;
  liveUrl?: string;
  twitchDisplayName?: string;
  twitchAvatarUrl?: string;
  discordChannelId: string;
  alertMessage: string;
  mentionRoleId?: string;
  bannerUrl?: string;
  enabled: boolean;
  updatedAt: string;
};

type DiscordAlertChannel = {
  id: string;
  name: string;
  type: number;
  parentId?: string | null;
};

type AuthUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

const apiBase = import.meta.env.VITE_API_URL || "";
const apiPath = (path: string) => `${apiBase}${path}`;
const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
const liveAlertChannelId = import.meta.env.VITE_LIVE_ALERT_CHANNEL_ID || "";

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "lives", label: "Sistema de Lives", icon: RadioTower, badge: "Live" },
  { id: "settings", label: "Configuracoes", icon: Settings },
  { id: "permissions", label: "Permissoes", icon: ShieldCheck, badge: "2" },
  { id: "modules", label: "Modulos", icon: Plug },
  { id: "logs", label: "Logs", icon: FileClock, badge: "8" },
  { id: "custom", label: "Personalizacao", icon: Paintbrush }
];

const configCards: ConfigCard[] = [
  {
    category: "Configuracoes",
    title: "Preferencias do servidor",
    description: "Defina canais padrao, respostas automaticas e comportamento principal do bot.",
    action: "Abrir",
    icon: SlidersHorizontal
  },
  {
    category: "Permissoes",
    title: "Cargos administrativos",
    description: "Controle quais cargos podem usar comandos, moderar eventos e alterar ajustes sensiveis.",
    action: "Gerenciar",
    icon: LockKeyhole,
    badge: "Pendente"
  },
  {
    category: "Modulos",
    title: "Central de modulos",
    description: "Ative ou pause sistemas de automacao, boas-vindas, tickets, lives e utilidades.",
    action: "Configurar",
    icon: Plug
  },
  {
    category: "Logs",
    title: "Registro de atividades",
    description: "Acompanhe eventos recentes, alteracoes no painel e respostas executadas pelo bot.",
    action: "Ver logs",
    icon: TerminalSquare,
    badge: "Novo"
  },
  {
    category: "Personalizacao",
    title: "Identidade do painel",
    description: "Reserve espaco para avatar, nome publico, mensagens, embeds e aparencia do sistema.",
    action: "Editar",
    icon: Paintbrush
  }
];

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

function LoginGate({ loading, authError }: { loading: boolean; authError?: string }) {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const errorMessage =
    error === "unauthorized_guild_member"
      ? "Sua conta nao tem permissao para acessar este dashboard."
      : error === "discord_client_id_missing"
        ? "O ID OAuth do Discord ainda nao foi configurado."
      : error === "discord_client_secret_missing"
        ? "O segredo OAuth do Discord ainda nao foi configurado."
        : error
          ? "Nao foi possivel concluir o login com Discord."
          : authError
            ? authError
          : "";

  return (
    <main className="login-shell">
      <section className="login-panel fade-in">
        <div className="logo-box login-logo">
          <Bot size={26} />
        </div>
        <p className="eyebrow">Acesso restrito</p>
        <h1>Steve Wonder Dashboard</h1>
        <p>Entre com sua conta Discord para liberar o painel de gerenciamento do bot.</p>
        {errorMessage ? <div className="login-error">{errorMessage}</div> : null}
        <a className="login-button login-primary" href={authPath("/discord")}>
          {loading ? "Verificando sessao..." : "Entrar com Discord"}
        </a>
      </section>
    </main>
  );
}

function Sidebar({
  open,
  activeView,
  onClose,
  onSelect
}: {
  open: boolean;
  activeView: ViewId;
  onClose: () => void;
  onSelect: (view: ViewId) => void;
}) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? "is-open" : ""}`} onClick={onClose} />

      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-left">
            <div className="logo-box">
              <Bot size={24} />
            </div>
            <div>
              <p className="eyebrow">Sistema</p>
              <h1>Steve Wonder</h1>
            </div>
          </div>
          <button className="icon-button mobile-only" onClick={onClose} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <div className="server-card">
          <p>Servidor conectado</p>
          <div className="server-user">
            <div className="server-avatar">SW</div>
            <div>
              <strong>Comunidade Principal</strong>
              <span>Administrador</span>
            </div>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.label}
                className={`nav-item ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  if (item.id === "dashboard" || item.id === "lives") onSelect(item.id);
                  onClose();
                }}
              >
                <span>
                  <Icon size={17} />
                  {item.label}
                </span>
                {item.badge ? <b>{item.badge}</b> : null}
              </button>
            );
          })}
        </nav>

        <div className="future-box">
          <p>Espaco preparado</p>
          <span>Novas abas, modulos e cards podem entrar pela lista de dados.</span>
        </div>
      </aside>
    </>
  );
}

function DashboardHome({ onOpenLives }: { onOpenLives: () => void }) {
  const quickStats = [
    { label: "Modulos ativos", value: "12", icon: Activity },
    { label: "Cargos liberados", value: "6", icon: UsersRound },
    { label: "Alertas pendentes", value: "3", icon: Bell }
  ];

  return (
    <>
      <section className="hero-row">
        <div className="hero-copy">
          <div className="status-pill">
            <i />
            Sistema operacional
          </div>
          <h2>Dashboard de controle</h2>
          <p>
            Organize configuracoes, permissoes, modulos, logs, personalizacao e lives em uma interface limpa para
            crescer junto com o bot.
          </p>
        </div>

        <div className="stats-grid">
          {quickStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="stat-card">
                <Icon size={18} />
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="cards-list">
        <article className="config-card live-feature-card">
          <div className="card-content">
            <div className="card-icon">
              <RadioTower size={21} />
            </div>
            <div>
              <div className="card-meta">
                <span>Sistema de Lives</span>
                <b>Novo</b>
              </div>
              <h3>Solicitacoes e alertas de live</h3>
              <p>Envie pedidos de live para aprovacao no Discord e configure alertas automaticos da Twitch.</p>
            </div>
          </div>
          <button className="card-action" onClick={onOpenLives}>
            Abrir lives
            <ChevronRight size={17} />
          </button>
        </article>

        {configCards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.title} className="config-card">
              <div className="card-content">
                <div className="card-icon">
                  <Icon size={21} />
                </div>
                <div>
                  <div className="card-meta">
                    <span>{card.category}</span>
                    {card.badge ? <b>{card.badge}</b> : null}
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </div>

              <button className="card-action">
                {card.action}
                <ChevronRight size={17} />
              </button>
            </article>
          );
        })}
      </section>

      <section className="bottom-grid">
        <RealtimeControlPanel />

        <div className="info-card">
          <div className="section-title">
            <Settings size={20} />
            <h3>Fila de futuras funcoes</h3>
          </div>
          {["Automacoes avancadas", "Mensagens programadas", "Relatorios do servidor"].map((item) => (
            <div className="mini-row" key={item}>
              <span>{item}</span>
              <b>Em breve</b>
            </div>
          ))}
        </div>

        <div className="info-card">
          <div className="section-title">
            <FileClock size={20} />
            <h3>Atividade recente</h3>
          </div>
          {["Permissao revisada", "Modulo de logs preparado", "Painel visual atualizado"].map((item) => (
            <div className="activity-row" key={item}>
              <span>{item}</span>
              <small>Registro do sistema</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function RealtimeControlPanel() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [botOnline, setBotOnline] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Aguardando acao em tempo real.");
  const [guildId, setGuildId] = useState("");

  useEffect(() => {
    const connection = io(socketUrl, { withCredentials: true, transports: ["websocket", "polling"] });
    setSocket(connection);

    connection.on("bot:statusUpdate", (payload) => {
      setBotOnline(Boolean(payload.online));
    });
    connection.on("bot:success", (payload) => {
      setPending(false);
      setMessage(payload.message || "Acao executada com sucesso.");
    });
    connection.on("bot:error", (payload) => {
      setPending(false);
      setMessage(payload.error || "O bot retornou erro.");
    });
    connection.on("connect_error", (error) => {
      setBotOnline(false);
      setMessage(error.message || "Falha ao conectar no backend em tempo real.");
    });

    return () => {
      connection.disconnect();
    };
  }, []);

  function emitAction(event: string, payload: Record<string, unknown>) {
    if (!socket?.connected) {
      setMessage("Socket do dashboard desconectado.");
      return;
    }

    setPending(true);
    setMessage("Enviando para o backend...");
    socket.emit(event, { guildId, ...payload }, (response: { ok: boolean; error?: string; actionId?: string }) => {
      if (!response?.ok) {
        setPending(false);
        setMessage(response?.error || "Backend recusou a acao.");
        return;
      }

      setMessage(`Acao enviada para o bot. ID: ${response.actionId}`);
    });
  }

  function submitLogChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    emitAction("site:setLogChannel", { channelId: form.get("channelId") });
  }

  function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    emitAction("site:sendAnnouncement", {
      channelId: form.get("announcementChannelId"),
      message: form.get("announcementMessage")
    });
  }

  function submitToggle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    emitAction("site:toggleSystem", {
      system: form.get("system"),
      enabled: form.get("enabled") === "on"
    });
  }

  return (
    <div className="info-card realtime-card">
      <div className="section-title">
        <Activity size={20} />
        <h3>Tempo real</h3>
        <span className={`realtime-dot ${botOnline ? "is-online" : ""}`} />
      </div>
      <p className="realtime-status">{botOnline ? "Bot online e conectado." : "Bot offline ou desconectado."}</p>

      <label className="realtime-field">
        Guild ID
        <input value={guildId} onChange={(event) => setGuildId(event.target.value)} placeholder="Opcional: usa GUILD_ID do backend" />
      </label>

      <form className="realtime-form" onSubmit={submitLogChannel}>
        <input name="channelId" required placeholder="ID do canal de logs" />
        <button className="ghost-action" disabled={pending}>Atualizar logs</button>
      </form>

      <form className="realtime-form" onSubmit={submitAnnouncement}>
        <input name="announcementChannelId" required placeholder="ID do canal de aviso" />
        <input name="announcementMessage" required placeholder="Mensagem do aviso" />
        <button className="ghost-action" disabled={pending}>Enviar aviso</button>
      </form>

      <form className="realtime-form" onSubmit={submitToggle}>
        <input name="system" required placeholder="Sistema: lives, welcome, logs..." />
        <label className="inline-check">
          <input name="enabled" type="checkbox" defaultChecked />
          Ativo
        </label>
        <button className="ghost-action" disabled={pending}>Alternar sistema</button>
      </form>

      <p className="realtime-message">{pending ? "Executando..." : message}</p>
    </div>
  );
}

function LiveCenter({ authUser, onLogout }: { authUser: AuthUser | null; onLogout: () => Promise<void> }) {
  const [twitchConfigs, setTwitchConfigs] = useState<TwitchConfig[]>([]);
  const [alertChannels, setAlertChannels] = useState<DiscordAlertChannel[]>([]);
  const [resolvedLiveAlertChannelId, setResolvedLiveAlertChannelId] = useState(liveAlertChannelId);
  const [loggedInAs, setLoggedInAs] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const channelCount = Math.min(twitchConfigs.length, 5);

  async function loadData() {
    setLoading(true);
    setAuthRequired(false);

    try {
      const [socialData, channelData] = await Promise.all([
        requestJson<{ twitch: TwitchConfig[]; loggedInAs?: string }>("/api/lives"),
        requestJson<{ channels: DiscordAlertChannel[]; liveAlertChannelId?: string }>("/api/lives/channels")
      ]);
      setTwitchConfigs(socialData.twitch || []);
      setAlertChannels(channelData.channels || []);
      setResolvedLiveAlertChannelId(channelData.liveAlertChannelId || liveAlertChannelId);
      setLoggedInAs(socialData.loggedInAs || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar as lives.";
      setAuthRequired(message.includes("autoriz") || message.includes("permiss") || message.includes("Unauthorized"));
      setToast(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const source = new EventSource(apiPath("/events"));
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== "connected") {
        setToast("Sistema de lives atualizado.");
        loadData();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submitTwitchConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await requestJson("/api/lives/twitch", {
        method: "POST",
        body: JSON.stringify({
          liveUrl: form.get("liveUrl"),
          discordChannelId: resolvedLiveAlertChannelId,
          alertMessage: "Live cadastrada pelo dashboard.",
          mentionRoleId: "",
          bannerUrl: "",
          enabled: form.get("enabled") === "on"
        })
      });
      formElement.reset();
      setModalOpen(false);
      setToast("Alerta Twitch cadastrado.");
      await loadData();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel cadastrar o alerta.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTwitchConfig(config: TwitchConfig) {
    try {
      await requestJson(`/api/lives/twitch/${config.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !config.enabled })
      });
      setToast(config.enabled ? "Alerta pausado." : "Alerta ativado.");
      await loadData();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel alterar o alerta.");
    }
  }

  async function removeTwitchConfig(id: string) {
    try {
      await requestJson(`/api/lives/twitch/${id}`, { method: "DELETE" });
      setToast("Alerta removido.");
      await loadData();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel remover o alerta.");
    }
  }

  function channelName(channelId: string) {
    const channel = alertChannels.find((item) => item.id === channelId);
    return channel ? `#${channel.name}` : channelId;
  }

  return (
    <>
      {toast ? <div className="toast">{toast}</div> : null}

      <section className="social-notifications">
        <div className="social-title-row">
          <h2>Social Notifications</h2>
          <Bell size={25} />
        </div>

        <article className="social-card">
          <div className="social-card-main">
            <div className="social-icon youtube-icon">
              <FaYoutube />
            </div>
            <div>
              <h3>YouTube</h3>
              <p>Notifications for published YouTube videos.</p>
            </div>
          </div>
          <button className="social-button social-button-blue">Set up</button>
        </article>

        <article className="social-card twitch-social-card">
          <div className="social-card-main">
            <div className="social-icon twitch-icon">
              <FaTwitch />
            </div>
            <div>
              <div className="social-heading-inline">
                <h3>Twitch</h3>
                <span>{channelCount}/5 +</span>
              </div>
              <p>Live updating notifications for Twitch streams.</p>
            </div>
          </div>
          <button className="social-button social-button-gray" onClick={() => setModalOpen(true)}>
            Add channel
          </button>

          <div className="registered-channels">
            {twitchConfigs.length ? (
              twitchConfigs.map((config) => (
                <div className="registered-channel" key={config.id}>
                  <div className="registered-left">
                    {config.twitchAvatarUrl ? (
                      <img src={config.twitchAvatarUrl} alt="" />
                    ) : (
                      <div className="registered-avatar">{(config.twitchDisplayName || config.twitchChannelName).slice(0, 2)}</div>
                    )}
                    <div>
                      <strong>@{config.twitchDisplayName || config.twitchChannelName}</strong>
                      <span>{channelName(config.discordChannelId)}</span>
                    </div>
                  </div>
                  <div className="registered-actions">
                    <button className="social-icon-button" onClick={() => toggleTwitchConfig(config)} aria-label="Configurar canal">
                      <Settings size={17} />
                    </button>
                    <button className="social-icon-button" onClick={() => removeTwitchConfig(config.id)} aria-label="Remover canal">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-social-state">
                {loading ? "Carregando canais cadastrados..." : "Nenhum canal Twitch cadastrado ainda."}
              </p>
            )}
          </div>

          <p className="social-login-line">
            <HelpCircle size={14} />
            {authUser ? (
              <>
                Logged in as {authUser.username}
                <button onClick={onLogout} type="button">
                  Log out
                </button>
              </>
            ) : loggedInAs ? (
              <>
                Logged in as {loggedInAs}
                <button onClick={onLogout} type="button">
                  Log out
                </button>
              </>
            ) : (
              "Aguardando login do Discord"
            )}
            {authRequired ? (
              <a href={authPath("/discord")}>Login with Discord</a>
            ) : null}
          </p>
        </article>

        <article className="social-card">
          <div className="social-card-main">
            <div className="social-icon tiktok-icon">
              <FaTiktok />
            </div>
            <div>
              <h3>TikTok</h3>
              <p>Notifications for published TikTok videos.</p>
            </div>
          </div>
          <button className="social-button social-button-blue">Set up</button>
        </article>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="social-modal" onSubmit={submitTwitchConfig} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add Twitch channel</h3>
                <p>Configure a live notification channel.</p>
              </div>
              <button type="button" className="social-icon-button" onClick={() => setModalOpen(false)} aria-label="Fechar modal">
                <X size={18} />
              </button>
            </div>

            <label>
              Link da live
              <input name="liveUrl" required placeholder="https://twitch.tv/nome_do_canal" />
            </label>
            <label>
              Canal do Discord
              <input value={channelName(resolvedLiveAlertChannelId)} readOnly />
            </label>
            <label className="toggle-label">
              <input name="enabled" type="checkbox" defaultChecked />
              Ativar alerta
            </label>
            <button className="social-button social-button-blue modal-save" disabled={saving}>
              Save channel
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch(authPath("/me"), { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Sessao nao encontrada no navegador." }));
          if (mounted) setAuthError(data.error || "Sessao nao encontrada no navegador.");
          return null;
        }
        if (mounted) setAuthError("");
        return response.json() as Promise<{ user: AuthUser }>;
      })
      .then((data) => {
        if (mounted) setAuthUser(data?.user || null);
      })
      .catch(() => {
        if (mounted) {
          setAuthUser(null);
          setAuthError("Nao foi possivel verificar sua sessao. Atualize a pagina e tente entrar novamente.");
        }
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await fetch(authPath("/logout"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    }).catch(() => null);
    setAuthUser(null);
  }

  if (authLoading || !authUser) {
    return <LoginGate loading={authLoading} authError={authError} />;
  }

  return (
    <main className={`app-shell ${activeView === "lives" ? "social-shell" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        activeView={activeView}
        onClose={() => setSidebarOpen(false)}
        onSelect={setActiveView}
      />

      <section className={`main-panel fade-in ${activeView === "lives" ? "social-main-panel" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
              <Menu size={21} />
            </button>
            <div className="divider" />
            <div>
              <p className="eyebrow">Painel do bot</p>
              <span>{activeView === "lives" ? "Social Notifications" : "Gerenciamento do servidor Discord"}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="search-button">
              <Search size={17} />
              Buscar
            </button>
            <button className="icon-button notification-button" aria-label="Notificacoes">
              <Bell size={17} />
              <i />
            </button>
            {authUser ? (
              <div className="profile-chip">
                <div>
                  {authUser.avatar ? <img src={authUser.avatar} alt="" /> : <UserRound size={17} />}
                </div>
                <span>
                  <strong>{authUser.username}</strong>
                  <small>Online</small>
                </span>
                <button className="logout-button" onClick={logout} aria-label="Sair">
                  Sair
                </button>
              </div>
            ) : (
              <a className="login-button" href={authPath("/discord")}>
                {authLoading ? "Verificando..." : "Entrar com Discord"}
              </a>
            )}
          </div>
        </header>

        <div className="content">
          {activeView === "dashboard" ? (
            <DashboardHome onOpenLives={() => setActiveView("lives")} />
          ) : (
            <LiveCenter authUser={authUser} onLogout={logout} />
          )}
        </div>
      </section>
    </main>
  );
}
