import {
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  Activity,
  Hash,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Trash2,
  Twitch,
  Users,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Page = "home" | "alerts" | "social" | "subs" | "channels" | "logs" | "settings";

type AuthUser = {
  id: string;
  username: string;
  avatar?: string | null;
  email?: string | null;
  lastLoginAt?: string | null;
  authenticated?: boolean;
  guilds?: Guild[];
};

type Guild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
};

type GuildOverview = {
  guild: {
    id: string;
    name: string;
    icon?: string | null;
    memberCount: number;
    onlineCount: number;
    botCount: number;
    newMemberCount: number;
    leaveCount: number;
    botOnline: boolean;
    lastStatsAt?: string | null;
  } | null;
  counters: {
    twitchChannels: number;
    activeTwitchChannels: number;
    socialNotifications: number;
    activeSubs: number;
  };
  logs: DashboardLog[];
};

type DashboardLog = {
  id: string;
  guildId: string;
  type: string;
  action: string;
  message: string;
  userId?: string | null;
  targetId?: string | null;
  createdAt: string;
};

type SocialPlatform = "TWITCH" | "YOUTUBE" | "TIKTOK" | "KICK";

type SocialConfig = {
  id?: string;
  guildId: string;
  platform: SocialPlatform;
  enabled: boolean;
  channelId: string;
  mentionRoleId: string;
  customMessage: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  thumbnailUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  updatedAt?: string;
};

type TextChannel = {
  id: string;
  name: string;
};

type LiveAlert = {
  id: string;
  guildId: string;
  streamerUrl: string;
  streamerName: string;
  twitchAvatarUrl?: string | null;
  textChannelId: string;
  mentionRoleId?: string | null;
  customMessage: string;
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: string | null;
  thumbnailUrl?: string | null;
  buttonLabel?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type AlertForm = {
  id?: string;
  streamerUrl: string;
  textChannelId: string;
  mentionRoleId: string;
  customMessage: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  thumbnailUrl: string;
  buttonLabel: string;
  enabled: boolean;
};

type DiscordRole = {
  id: string;
  name: string;
  managed?: boolean;
};

type TwitchSubConfig = {
  guildId: string;
  broadcasterLogin: string;
  broadcasterConnected: boolean;
  primeRoleId: string;
  tier1RoleId: string;
  tier2RoleId: string;
  tier3RoleId: string;
  logChannelId: string;
  syncIntervalHours: number;
};

type TwitchSubLog = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
};

type TwitchSubStat = {
  tier: string | null;
  active: boolean;
  _count: { _all: number };
};

const apiBase = import.meta.env.VITE_API_URL || "";
const apiPath = (path: string) => `${apiBase}${path}`;
const authPath = (path: string) => apiPath(`/api/auth${path}`);
const sessionStorageKey = "live_alerts_session";

const defaultLiveUrl = import.meta.env.VITE_DEFAULT_TWITCH_ALERT_URL || "https://www.twitch.tv/ricardinn98";
const defaultMessage = "@everyone";
const defaultEmbedTitle = "{streamer} is now live on Twitch!";
const defaultEmbedDescription = "@{login} {title}";
const defaultEmbedColor = "#9146FF";
const defaultButtonLabel = "Watch Stream";
const socialPlatforms: SocialPlatform[] = ["TWITCH", "YOUTUBE", "TIKTOK", "KICK"];

function defaultAlertForm(textChannelId = ""): AlertForm {
  return {
    streamerUrl: defaultLiveUrl,
    textChannelId,
    mentionRoleId: "",
    customMessage: defaultMessage,
    embedTitle: defaultEmbedTitle,
    embedDescription: defaultEmbedDescription,
    embedColor: defaultEmbedColor,
    thumbnailUrl: "",
    buttonLabel: defaultButtonLabel,
    enabled: true
  };
}

function emptySocialConfig(guildId: string, platform: SocialPlatform): SocialConfig {
  return {
    guildId,
    platform,
    enabled: false,
    channelId: "",
    mentionRoleId: "",
    customMessage: platform === "TWITCH" ? defaultMessage : `{platform} atualizado em {url}`,
    embedTitle: platform === "TWITCH" ? defaultEmbedTitle : `${platform} Notification`,
    embedDescription: platform === "TWITCH" ? defaultEmbedDescription : "",
    embedColor: platform === "TWITCH" ? defaultEmbedColor : "#5865F2",
    thumbnailUrl: "",
    buttonLabel: platform === "TWITCH" ? defaultButtonLabel : "Acessar",
    buttonUrl: ""
  };
}

function readCookie(name: string) {
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function readLocalSession() {
  try {
    return localStorage.getItem(sessionStorageKey) || "";
  } catch {
    return "";
  }
}

function writeSession(session: string) {
  try {
    localStorage.setItem(sessionStorageKey, session);
  } catch {
    // Cookie fallback keeps auth working in browsers that block localStorage.
  }

  document.cookie = `live_alerts_session_fallback=${encodeURIComponent(session)}; path=/; max-age=604800; SameSite=Lax`;
}

function clearStoredSession() {
  try {
    localStorage.removeItem(sessionStorageKey);
  } catch {
    // Cookie cleanup below is enough when storage is unavailable.
  }

  document.cookie = "live_alerts_session_fallback=; path=/; max-age=0; SameSite=Lax";
}

function storedSessionToken() {
  return readLocalSession() || decodeURIComponent(readCookie("live_alerts_session_fallback") || "");
}

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const storedSession = storedSessionToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  let response: Response;

  try {
    response = await fetch(apiPath(path), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(storedSession ? { Authorization: `Bearer ${storedSession}` } : {}),
        ...(options?.headers || {})
      },
      ...options,
      signal: options?.signal || controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo esgotado ao conectar com a API.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Erro ao processar requisicao." }));
    if (response.status === 401) {
      clearStoredSession();
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new Error(data.error || "Erro ao processar requisicao.");
  }

  return response.json();
}

function captureSessionFromUrl() {
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  const session = hashParams.get("session") || searchParams.get("session");

  if (!session) return;

  writeSession(session);
  window.history.replaceState(null, document.title, window.location.pathname || "/");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatFullDate(value?: string | null) {
  if (!value) return "Ainda nao registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda nao registrado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function LoginScreen({ error }: { error: string }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="logo-mark">
          <Bot size={34} />
        </div>
        <p className="eyebrow">Live Alerts</p>
        <h1>Painel de alertas para Discord</h1>
        <p className="login-copy">
          Entre com sua conta Discord para configurar alertas de live apenas nos servidores em que voce e administrador.
        </p>
        {error ? <div className="toast error">{error}</div> : null}
        <a className="discord-button" href={authPath("/discord")}>
          <LogIn size={19} />
          Entrar com Discord
        </a>
      </section>
    </main>
  );
}

function Sidebar({
  page,
  user,
  mobileOpen,
  onPage,
  onClose,
  onLogout
}: {
  page: Page;
  user: AuthUser;
  mobileOpen: boolean;
  onPage: (page: Page) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const items = [
    { id: "home" as const, label: "Inicio", icon: LayoutDashboard },
    { id: "alerts" as const, label: "Alertas de Live", icon: RadioTower },
    { id: "social" as const, label: "Social", icon: Bell },
    { id: "subs" as const, label: "Subs Twitch", icon: Twitch },
    { id: "channels" as const, label: "Canais", icon: Hash },
    { id: "logs" as const, label: "Logs", icon: Activity },
    { id: "settings" as const, label: "Configuracoes", icon: Settings }
  ];

  return (
    <>
      <div className={`sidebar-backdrop ${mobileOpen ? "open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Twitch size={24} />
          </div>
          <div>
            <strong>Live Alerts</strong>
            <span>Discord bot panel</span>
          </div>
          <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${page === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => {
                  onPage(item.id);
                  onClose();
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="user-card">
          <div className="avatar-box">
            {user.avatar ? <img src={user.avatar} alt="" /> : <Bot size={18} />}
          </div>
          <div>
            <strong>{user.username}</strong>
            <span>Conta Discord</span>
          </div>
        </div>

        <button className="nav-item logout" type="button" onClick={onLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>
    </>
  );
}

function AlertModal({
  form,
  channels,
  roles,
  saving,
  onChange,
  onClose,
  onSave
}: {
  form: AlertForm;
  channels: TextChannel[];
  roles: DiscordRole[];
  saving: boolean;
  onChange: (form: AlertForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const roleOptions = roles.filter((role) => !role.managed);

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <section className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Twitch / Lives</p>
            <h2>{form.id ? "Editar Canal" : "Adicionar Canal"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        <label className="field">
          <span>URL do canal da live</span>
          <input
            placeholder={defaultLiveUrl}
            value={form.streamerUrl}
            onChange={(event) => onChange({ ...form, streamerUrl: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Canal de texto do Discord</span>
          <select
            value={form.textChannelId}
            onChange={(event) => onChange({ ...form, textChannelId: event.target.value })}
          >
            <option value="">Selecione um canal</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cargo para mencionar</span>
          <select
            value={form.mentionRoleId}
            onChange={(event) => onChange({ ...form, mentionRoleId: event.target.value })}
          >
            <option value="">Sem cargo</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                @{role.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Mensagem personalizada do alerta</span>
          <textarea
            rows={5}
            value={form.customMessage}
            onChange={(event) => onChange({ ...form, customMessage: event.target.value })}
          />
        </label>

        <div className="modal-form-grid">
          <label className="field">
            <span>Titulo da embed</span>
            <input
              placeholder={defaultEmbedTitle}
              value={form.embedTitle}
              onChange={(event) => onChange({ ...form, embedTitle: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Cor da embed</span>
            <input
              type="color"
              value={form.embedColor || defaultEmbedColor}
              onChange={(event) => onChange({ ...form, embedColor: event.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>Descricao da embed</span>
          <textarea
            rows={3}
            placeholder={defaultEmbedDescription}
            value={form.embedDescription}
            onChange={(event) => onChange({ ...form, embedDescription: event.target.value })}
          />
        </label>

        <div className="modal-form-grid">
          <label className="field">
            <span>Thumbnail</span>
            <input
              placeholder="https://..."
              value={form.thumbnailUrl}
              onChange={(event) => onChange({ ...form, thumbnailUrl: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Botao da live</span>
            <input
              value={form.buttonLabel}
              onChange={(event) => onChange({ ...form, buttonLabel: event.target.value })}
            />
          </label>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => onChange({ ...form, enabled: event.target.checked })}
          />
          <span>Status ativado</span>
        </label>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfigCard({
  icon: Icon,
  title,
  description,
  action,
  badge,
  onClick
}: {
  icon: typeof Settings;
  title: string;
  description: string;
  action: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <article className="config-row-card">
      <div className="config-row-icon">
        <Icon size={20} />
      </div>
      <div className="config-row-copy">
        <div>
          <h3>{title}</h3>
          {badge ? <span className="tiny-badge">{badge}</span> : null}
        </div>
        <p>{description}</p>
      </div>
      <button className="small-card-button" type="button" onClick={onClick}>
        {action}
      </button>
    </article>
  );
}

function CategorySection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="category-section">
      <div className="category-heading">
        <p className="eyebrow">{title}</p>
        <span>{description}</span>
      </div>
      <div className="config-card-list">{children}</div>
    </section>
  );
}

function AuthOverview({
  user,
  guilds,
  selectedGuildId,
  onSelectGuild
}: {
  user: AuthUser;
  guilds: Guild[];
  selectedGuildId: string;
  onSelectGuild: (guildId: string) => void;
}) {
  return (
    <section className="auth-overview">
      <article className="auth-profile-card">
        <div className="auth-profile-main">
          <div className="auth-avatar">
            {user.avatar ? <img src={user.avatar} alt="" /> : <Bot size={28} />}
          </div>
          <div>
            <span className="auth-status-pill">
              <CheckCircle2 size={15} />
              Autenticado
            </span>
            <h2>{user.username}</h2>
            <p>Conta Discord liberada para acessar a Dashboard.</p>
          </div>
        </div>

        <div className="identity-grid">
          <div className="identity-item">
            <Hash size={17} />
            <span>Discord ID</span>
            <strong>{user.id}</strong>
          </div>
          <div className="identity-item">
            <Mail size={17} />
            <span>E-mail</span>
            <strong>{user.email || "Nao autorizado"}</strong>
          </div>
          <div className="identity-item wide-identity">
            <CalendarClock size={17} />
            <span>Ultimo acesso</span>
            <strong>{formatFullDate(user.lastLoginAt)}</strong>
          </div>
        </div>
      </article>

      <article className="auth-servers-card">
        <div className="panel-header compact-panel-header">
          <div>
            <p className="eyebrow">Servidores</p>
            <h2>Disponiveis para gerenciamento</h2>
          </div>
          <span className="connection-pill online">
            <Server size={14} />
            {guilds.length}
          </span>
        </div>

        <div className="auth-server-list">
          {guilds.length ? (
            guilds.map((guild) => (
              <button
                className={`server-tile ${guild.id === selectedGuildId ? "selected" : ""}`}
                key={guild.id}
                type="button"
                onClick={() => onSelectGuild(guild.id)}
              >
                <div className="avatar-box compact-avatar">
                  {guild.icon ? <img src={guild.icon} alt="" /> : <Server size={16} />}
                </div>
                <div>
                  <strong>{guild.name}</strong>
                  <span>{guild.owner ? "Owner" : "Manage Guild"}</span>
                </div>
                {guild.id === selectedGuildId ? <CheckCircle2 size={17} /> : null}
              </button>
            ))
          ) : (
            <div className="compact-empty-state">
              <Server size={22} />
              <strong>Nenhum servidor disponivel</strong>
              <span>Entre com uma conta que possua Administrator ou Manage Guild.</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function TwitchSubsView({
  config,
  roles,
  channels,
  logs,
  stats,
  saving,
  onConfig,
  onSave,
  onConnectBroadcaster,
  onSync
}: {
  config: TwitchSubConfig;
  roles: DiscordRole[];
  channels: TextChannel[];
  logs: TwitchSubLog[];
  stats: TwitchSubStat[];
  saving: boolean;
  onConfig: (config: TwitchSubConfig) => void;
  onSave: () => void;
  onConnectBroadcaster: () => void;
  onSync: () => void;
}) {
  const roleOptions = roles.filter((role) => !role.managed);
  const totalActive = stats.filter((item) => item.active).reduce((total, item) => total + item._count._all, 0);
  const countByTier = (tier: string) =>
    stats.find((item) => item.active && item.tier === tier)?._count._all || 0;

  function roleSelect(label: string, value: string, keyName: keyof TwitchSubConfig) {
    return (
      <label className="field compact-field">
        <span>{label}</span>
        <select value={value} onChange={(event) => onConfig({ ...config, [keyName]: event.target.value })}>
          <option value="">Selecione um cargo</option>
          {roleOptions.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section className="view-grid">
      <div className="stats-grid">
        <article className="stat-card">
          <Twitch size={22} />
          <span>Total de subs</span>
          <strong>{totalActive}</strong>
        </article>
        <article className="stat-card">
          <CheckCircle2 size={22} />
          <span>Tier 1</span>
          <strong>{countByTier("1000")}</strong>
        </article>
        <article className="stat-card">
          <CheckCircle2 size={22} />
          <span>Tier 2 / Tier 3</span>
          <strong>{countByTier("2000") + countByTier("3000")}</strong>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Twitch Subscribers</p>
            <h2>Configuracoes Twitch + Discord</h2>
          </div>
          <div className="row-actions wrap-actions">
            <button className="secondary-button" type="button" onClick={onConnectBroadcaster}>
              <Twitch size={18} />
              Conectar Broadcaster
            </button>
            <button className="primary-button" type="button" onClick={onSync}>
              <RefreshCw size={18} />
              Verificar Agora
            </button>
          </div>
        </div>

        <div className="form-grid">
          <label className="field compact-field">
            <span>Canal da Twitch</span>
            <input
              placeholder="nome_do_canal"
              value={config.broadcasterLogin}
              onChange={(event) => onConfig({ ...config, broadcasterLogin: event.target.value })}
            />
          </label>
          <label className="field compact-field">
            <span>Intervalo de verificacao</span>
            <select
              value={config.syncIntervalHours}
              onChange={(event) => onConfig({ ...config, syncIntervalHours: Number(event.target.value) })}
            >
              <option value={12}>12 horas</option>
              <option value={24}>24 horas</option>
            </select>
          </label>
          {roleSelect("Cargo Prime Gaming", config.primeRoleId, "primeRoleId")}
          {roleSelect("Cargo Tier 1", config.tier1RoleId, "tier1RoleId")}
          {roleSelect("Cargo Tier 2", config.tier2RoleId, "tier2RoleId")}
          {roleSelect("Cargo Tier 3", config.tier3RoleId, "tier3RoleId")}
          <label className="field compact-field">
            <span>Canal de logs</span>
            <select
              value={config.logChannelId}
              onChange={(event) => onConfig({ ...config, logChannelId: event.target.value })}
            >
              <option value="">Selecione um canal</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="panel-footer">
          <span className={`status-dot ${config.broadcasterConnected ? "ok" : ""}`}>
            {config.broadcasterConnected ? "Broadcaster conectado" : "Broadcaster pendente"}
          </span>
          <button className="primary-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Salvar Configuracoes
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Logs</p>
            <h2>Historico de sincronizacao</h2>
          </div>
        </div>
        <div className="log-list">
          {logs.length ? (
            logs.map((log) => (
              <article className="log-row" key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.message}</span>
                <small>{formatDate(log.createdAt)}</small>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Twitch size={28} />
              <strong>Nenhum log ainda</strong>
              <span>Os vinculos, cargos adicionados e cargos removidos vao aparecer aqui.</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function SocialNotificationsView({
  configs,
  channels,
  roles,
  selectedPlatform,
  draft,
  saving,
  onSelect,
  onDraft,
  onSave
}: {
  configs: SocialConfig[];
  channels: TextChannel[];
  roles: DiscordRole[];
  selectedPlatform: SocialPlatform;
  draft: SocialConfig;
  saving: boolean;
  onSelect: (platform: SocialPlatform) => void;
  onDraft: (config: SocialConfig) => void;
  onSave: () => void;
}) {
  const roleOptions = roles.filter((role) => !role.managed);
  const platformConfig = (platform: SocialPlatform) => configs.find((config) => config.platform === platform);

  return (
    <section className="view-grid">
      <div className="social-platform-grid">
        {socialPlatforms.map((platform) => {
          const config = platformConfig(platform);
          const active = config?.enabled;

          return (
            <button
              className={`social-platform-card ${selectedPlatform === platform ? "selected" : ""}`}
              key={platform}
              type="button"
              onClick={() => onSelect(platform)}
            >
              <RadioTower size={20} />
              <strong>{platform}</strong>
              <span>{active ? "Ativo" : "Inativo"}</span>
            </button>
          );
        })}
      </div>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Social Notifications</p>
            <h2>{selectedPlatform}</h2>
          </div>
          <span className={`status-dot ${draft.enabled ? "ok" : ""}`}>
            {draft.enabled ? "Sincronizado" : "Desativado"}
          </span>
        </div>

        <div className="form-grid">
          <label className="field compact-field">
            <span>Canal de envio</span>
            <select value={draft.channelId} onChange={(event) => onDraft({ ...draft, channelId: event.target.value })}>
              <option value="">Selecione um canal</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact-field">
            <span>Cargo para mencionar</span>
            <select
              value={draft.mentionRoleId}
              onChange={(event) => onDraft({ ...draft, mentionRoleId: event.target.value })}
            >
              <option value="">Sem cargo</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  @{role.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field compact-field">
            <span>Titulo da embed</span>
            <input
              value={draft.embedTitle}
              onChange={(event) => onDraft({ ...draft, embedTitle: event.target.value })}
            />
          </label>

          <label className="field compact-field">
            <span>Cor da embed</span>
            <input
              type="color"
              value={draft.embedColor || "#5865F2"}
              onChange={(event) => onDraft({ ...draft, embedColor: event.target.value })}
            />
          </label>

          <label className="field compact-field wide-field">
            <span>Mensagem personalizada</span>
            <textarea
              rows={4}
              value={draft.customMessage}
              onChange={(event) => onDraft({ ...draft, customMessage: event.target.value })}
            />
          </label>

          <label className="field compact-field wide-field">
            <span>Descricao da embed</span>
            <textarea
              rows={4}
              value={draft.embedDescription}
              onChange={(event) => onDraft({ ...draft, embedDescription: event.target.value })}
            />
          </label>

          <label className="field compact-field">
            <span>Thumbnail</span>
            <input
              placeholder="https://..."
              value={draft.thumbnailUrl}
              onChange={(event) => onDraft({ ...draft, thumbnailUrl: event.target.value })}
            />
          </label>

          <label className="field compact-field">
            <span>URL do botao</span>
            <input
              placeholder="https://..."
              value={draft.buttonUrl}
              onChange={(event) => onDraft({ ...draft, buttonUrl: event.target.value })}
            />
          </label>

          <label className="field compact-field">
            <span>Texto do botao</span>
            <input
              value={draft.buttonLabel}
              onChange={(event) => onDraft({ ...draft, buttonLabel: event.target.value })}
            />
          </label>

          <label className="toggle-row inline-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => onDraft({ ...draft, enabled: event.target.checked })}
            />
            <span>Ativar notificacao</span>
          </label>
        </div>

        <div className="panel-footer">
          <span className="muted-cell">Salvar emite Dashboard, Banco, Socket e Bot.</span>
          <button className="primary-button" type="button" onClick={onSave} disabled={saving || !draft.channelId}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [channels, setChannels] = useState<TextChannel[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [overview, setOverview] = useState<GuildOverview | null>(null);
  const [dashboardLogs, setDashboardLogs] = useState<DashboardLog[]>([]);
  const [socialConfigs, setSocialConfigs] = useState<SocialConfig[]>([]);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState<SocialPlatform>("TWITCH");
  const [socialDraft, setSocialDraft] = useState<SocialConfig>(emptySocialConfig("", "TWITCH"));
  const [botOnline, setBotOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [subConfig, setSubConfig] = useState<TwitchSubConfig>({
    guildId: "",
    broadcasterLogin: "",
    broadcasterConnected: false,
    primeRoleId: "",
    tier1RoleId: "",
    tier2RoleId: "",
    tier3RoleId: "",
    logChannelId: "",
    syncIntervalHours: 12
  });
  const [subLogs, setSubLogs] = useState<TwitchSubLog[]>([]);
  const [subStats, setSubStats] = useState<TwitchSubStat[]>([]);
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AlertForm>(defaultAlertForm());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGuild = useMemo(
    () => guilds.find((guild) => guild.id === selectedGuildId) || null,
    [guilds, selectedGuildId]
  );

  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.enabled).length, [alerts]);
  const memberStats = overview?.guild;
  const latestLogs = dashboardLogs.length ? dashboardLogs : overview?.logs || [];

  async function loadSession() {
    setLoading(true);
    setError("");

    try {
      const session = await apiJson<{ user: AuthUser }>("/api/auth/me", { cache: "no-store" });
      setUser(session.user);
      if (session.user.guilds?.length) {
        setGuilds(session.user.guilds);
        setSelectedGuildId((current) => current || session.user.guilds?.[0]?.id || "");
      }
      try {
        const guildData = await apiJson<{ guilds: Guild[] }>("/api/lives/guilds", { cache: "no-store" });
        setGuilds(guildData.guilds);
        setSelectedGuildId((current) => current || guildData.guilds[0]?.id || "");
      } catch (guildError) {
        setGuilds([]);
        setSelectedGuildId("");
        setError(guildError instanceof Error ? guildError.message : "Sessao criada, mas nao foi possivel listar servidores.");
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Login Discord obrigatorio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadGuildData(guildId: string) {
    if (!guildId) {
      setChannels([]);
      setAlerts([]);
      setOverview(null);
      setDashboardLogs([]);
      setSocialConfigs([]);
      setSocialDraft(emptySocialConfig("", selectedSocialPlatform));
      return;
    }

    setError("");

    try {
      const [channelData, alertData, overviewData, socialData, logData] = await Promise.all([
        apiJson<{ channels: TextChannel[] }>(`/api/lives/guilds/${guildId}/channels`, { cache: "no-store" }),
        apiJson<{ alerts: LiveAlert[] }>(`/api/lives?guildId=${guildId}`, { cache: "no-store" }),
        apiJson<GuildOverview>(`/api/dashboard/guilds/${guildId}/overview`, { cache: "no-store" }),
        apiJson<{ configs: SocialConfig[] }>(`/api/dashboard/guilds/${guildId}/social-notifications`, {
          cache: "no-store"
        }),
        apiJson<{ logs: DashboardLog[] }>(`/api/dashboard/guilds/${guildId}/logs`, { cache: "no-store" })
      ]);
      setChannels(channelData.channels);
      setAlerts(alertData.alerts);
      setOverview(overviewData);
      setDashboardLogs(logData.logs || overviewData.logs || []);
      const mergedConfigs = socialPlatforms.map(
        (platform) => socialData.configs.find((config) => config.platform === platform) || emptySocialConfig(guildId, platform)
      );
      setSocialConfigs(mergedConfigs);
      setSocialDraft(
        mergedConfigs.find((config) => config.platform === selectedSocialPlatform) ||
          emptySocialConfig(guildId, selectedSocialPlatform)
      );
      await loadSubConfig(guildId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o servidor.");
    }
  }

  async function loadSubConfig(guildId: string) {
    const data = await apiJson<{
      config: TwitchSubConfig | null;
      roles: DiscordRole[];
      channels: TextChannel[];
      logs: TwitchSubLog[];
      stats: TwitchSubStat[];
    }>(`/api/twitch-subs/config?guildId=${guildId}`, { cache: "no-store" });

    setRoles(data.roles || []);
    if (data.channels?.length) setChannels(data.channels);
    setSubLogs(data.logs || []);
    setSubStats(data.stats || []);
    setSubConfig(
      data.config || {
        guildId,
        broadcasterLogin: "",
        broadcasterConnected: false,
        primeRoleId: "",
        tier1RoleId: "",
        tier2RoleId: "",
        tier3RoleId: "",
        logChannelId: "",
        syncIntervalHours: 12
      }
    );
  }

  useEffect(() => {
    captureSessionFromUrl();
    loadSession();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setGuilds([]);
      setSelectedGuildId("");
      setError("Sessao expirada. Entre novamente com Discord.");
    };

    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, []);

  useEffect(() => {
    if (user) {
      loadGuildData(selectedGuildId);
    }
  }, [selectedGuildId, user]);

  useEffect(() => {
    if (!user) {
      socket?.disconnect();
      setSocket(null);
      setSocketConnected(false);
      setBotOnline(false);
      return;
    }

    const nextSocket = io(apiBase || window.location.origin, {
      auth: { token: storedSessionToken() },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    nextSocket.on("connect", () => setSocketConnected(true));
    nextSocket.on("disconnect", () => setSocketConnected(false));
    nextSocket.on("bot:statusUpdate", (payload) => setBotOnline(Boolean(payload?.online)));
    nextSocket.on("guild:overview", (payload) => {
      if (payload?.guildId !== selectedGuildId) return;
      setOverview(payload.overview || null);
      if (payload.overview?.logs) setDashboardLogs(payload.overview.logs);
    });
    nextSocket.on("guild:stats", (payload) => {
      if (payload?.guildId !== selectedGuildId) return;
      setOverview((current) => ({
        guild: payload.stats,
        counters: current?.counters || {
          twitchChannels: alerts.length,
          activeTwitchChannels: activeAlerts,
          socialNotifications: socialConfigs.length,
          activeSubs: subStats.filter((item) => item.active).reduce((total, item) => total + item._count._all, 0)
        },
        logs: current?.logs || []
      }));
    });
    nextSocket.on("guild:log", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.log) return;
      setDashboardLogs((current) => [payload.log, ...current.filter((log) => log.id !== payload.log.id)].slice(0, 80));
    });
    nextSocket.on("social:notification.updated", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.config) return;
      setSocialConfigs((current) =>
        socialPlatforms.map((platform) =>
          payload.config.platform === platform
            ? payload.config
            : current.find((config) => config.platform === platform) || emptySocialConfig(selectedGuildId, platform)
        )
      );
      if (payload.config.platform === selectedSocialPlatform) setSocialDraft(payload.config);
    });
    nextSocket.on("twitch:channel.created", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.alert) return;
      setAlerts((current) => [payload.alert, ...current.filter((alert) => alert.id !== payload.alert.id)]);
    });
    nextSocket.on("twitch:channel.updated", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.alert) return;
      setAlerts((current) => current.map((alert) => (alert.id === payload.alert.id ? payload.alert : alert)));
    });
    nextSocket.on("twitch:channel.toggled", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.alert) return;
      setAlerts((current) => current.map((alert) => (alert.id === payload.alert.id ? payload.alert : alert)));
    });
    nextSocket.on("twitch:channel.deleted", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.alert) return;
      setAlerts((current) => current.filter((alert) => alert.id !== payload.alert.id));
    });
    nextSocket.on("twitch:sub.config.updated", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.config) return;
      setSubConfig(payload.config);
    });
    nextSocket.on("twitch:sub.log", (payload) => {
      if (payload?.guildId !== selectedGuildId || !payload.log) return;
      setSubLogs((current) => [payload.log, ...current.filter((log) => log.id !== payload.log.id)].slice(0, 30));
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
    };
  }, [user?.id, selectedGuildId]);

  useEffect(() => {
    if (!socket || !selectedGuildId) return;
    socket.emit("dashboard:joinGuild", { guildId: selectedGuildId });
  }, [socket, selectedGuildId]);

  useEffect(() => {
    setSocialDraft(
      socialConfigs.find((config) => config.platform === selectedSocialPlatform) ||
        emptySocialConfig(selectedGuildId, selectedSocialPlatform)
    );
  }, [selectedSocialPlatform, socialConfigs, selectedGuildId]);

  function openCreateModal() {
    setForm(defaultAlertForm(channels[0]?.id || ""));
    setModalOpen(true);
  }

  function openEditModal(alert: LiveAlert) {
    setForm({
      id: alert.id,
      streamerUrl: alert.streamerUrl || defaultLiveUrl,
      textChannelId: alert.textChannelId,
      mentionRoleId: alert.mentionRoleId || "",
      customMessage: alert.customMessage || defaultMessage,
      embedTitle: alert.embedTitle || defaultEmbedTitle,
      embedDescription: alert.embedDescription || defaultEmbedDescription,
      embedColor: alert.embedColor || defaultEmbedColor,
      thumbnailUrl: alert.thumbnailUrl || "",
      buttonLabel: alert.buttonLabel || defaultButtonLabel,
      enabled: alert.enabled
    });
    setModalOpen(true);
  }

  async function saveAlert() {
    if (!selectedGuildId) {
      setError("Selecione um servidor para configurar o alerta.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = JSON.stringify({
        guildId: selectedGuildId,
        streamerUrl: form.streamerUrl,
        textChannelId: form.textChannelId,
        mentionRoleId: form.mentionRoleId,
        customMessage: form.customMessage,
        embedTitle: form.embedTitle,
        embedDescription: form.embedDescription,
        embedColor: form.embedColor,
        thumbnailUrl: form.thumbnailUrl,
        buttonLabel: form.buttonLabel,
        enabled: form.enabled
      });
      const path = form.id ? `/api/lives/twitch/${form.id}` : "/api/lives/twitch";
      const method = form.id ? "PUT" : "POST";
      await apiJson(path, { method, body });
      await loadGuildData(selectedGuildId);
      setModalOpen(false);
      setMessage(form.id ? "Alerta atualizado com sucesso." : "Canal adicionado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o alerta.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAlert(alert: LiveAlert) {
    setError("");
    await apiJson(`/api/lives/twitch/${alert.id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !alert.enabled })
    })
      .then(() => loadGuildData(selectedGuildId))
      .catch((err) => setError(err instanceof Error ? err.message : "Nao foi possivel alterar o status."));
  }

  async function deleteAlert(alert: LiveAlert) {
    setError("");
    await apiJson(`/api/lives/twitch/${alert.id}`, { method: "DELETE" })
      .then(() => {
        setMessage("Alerta excluido com sucesso.");
        return loadGuildData(selectedGuildId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Nao foi possivel excluir o alerta."));
  }

  async function saveSubConfig() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiJson("/api/twitch-subs/config", {
        method: "PUT",
        body: JSON.stringify({ ...subConfig, guildId: selectedGuildId })
      });
      await loadSubConfig(selectedGuildId);
      setMessage("Configuracoes Twitch salvas com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar as configuracoes Twitch.");
    } finally {
      setSaving(false);
    }
  }

  async function syncSubsNow() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiJson<{ checked: number }>("/api/twitch-subs/sync", {
        method: "POST",
        body: JSON.stringify({ guildId: selectedGuildId })
      });
      await loadSubConfig(selectedGuildId);
      setMessage(`Sincronizacao concluida: ${result.checked} conta(s) verificadas.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel sincronizar os subs.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSocialConfig() {
    if (!selectedGuildId) {
      setError("Selecione um servidor para configurar notificacoes sociais.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiJson<{ config: SocialConfig }>(
        `/api/dashboard/guilds/${selectedGuildId}/social-notifications/${selectedSocialPlatform}`,
        {
          method: "PUT",
          body: JSON.stringify(socialDraft)
        }
      );

      setSocialConfigs((current) =>
        socialPlatforms.map((platform) =>
          data.config.platform === platform
            ? data.config
            : current.find((config) => config.platform === platform) || emptySocialConfig(selectedGuildId, platform)
        )
      );
      setSocialDraft(data.config);
      setMessage(`${selectedSocialPlatform} sincronizado com sucesso.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a notificacao social.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const storedSession = storedSessionToken();
    await fetch(authPath("/logout"), {
      method: "POST",
      credentials: "include",
      headers: storedSession ? { Authorization: `Bearer ${storedSession}` } : undefined
    }).catch(() => null);
    clearStoredSession();
    setUser(null);
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={30} />
        <span className="loading-text">Carregando dashboard...</span>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen error={error} />;
  }

  return (
    <main className="app-shell">
      <Sidebar
        page={page}
        user={user}
        mobileOpen={mobileOpen}
        onPage={setPage}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <section className="dashboard-shell">
        <header className="topbar">
          <button className="icon-button menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <div className="topbar-logo">
              <Bot size={19} />
            </div>
            <div>
            <p className="eyebrow">Dashboard</p>
            <h1>
              {page === "alerts"
                ? "Alertas de Live"
                : page === "social"
                  ? "Social Notifications"
                  : page === "subs"
                    ? "Subs Twitch"
                    : page === "logs"
                      ? "Logs em Tempo Real"
                      : "Painel de Controle"}
            </h1>
            </div>
          </div>
          <div className="topbar-right">
            <span className={`connection-pill ${socketConnected ? "online" : ""}`}>
              {socketConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              Socket
            </span>
            <span className={`connection-pill ${botOnline ? "online" : ""}`}>
              <Bot size={14} />
              Bot
            </span>
            <button className="icon-button notification-button" type="button" aria-label="Notificacoes">
              <Bell size={18} />
              <span />
            </button>
            <select value={selectedGuildId} onChange={(event) => setSelectedGuildId(event.target.value)}>
              {guilds.length ? (
                guilds.map((guild) => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name}
                  </option>
                ))
              ) : (
                <option value="">Nenhum servidor admin</option>
              )}
            </select>
            <div className="top-profile">
              <div className="avatar-box compact-avatar">
                {user.avatar ? <img src={user.avatar} alt="" /> : <Bot size={16} />}
              </div>
              <div>
                <strong>{user.username}</strong>
                <span>ID {user.id}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          {error ? <div className="toast error">{error}</div> : null}
          {message ? <div className="toast success">{message}</div> : null}

          {page === "home" ? (
            <>
              <section className="page-intro fade-in">
                <div>
                  <p className="eyebrow">Painel administrativo</p>
                  <h2>{selectedGuild?.name || "Dashboard do bot"}</h2>
                  <span>Gerencie módulos, permissões, logs e integrações em uma estrutura pronta para crescer.</span>
                </div>
              </section>

              <AuthOverview
                user={user}
                guilds={guilds}
                selectedGuildId={selectedGuildId}
                onSelectGuild={setSelectedGuildId}
              />

              <section className="stats-grid">
                <article className="stat-card">
                  <Users size={22} />
                  <span>Total de membros</span>
                  <strong>{memberStats?.memberCount ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <Activity size={22} />
                  <span>Online</span>
                  <strong>{memberStats?.onlineCount ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <Bot size={22} />
                  <span>Bots</span>
                  <strong>{memberStats?.botCount ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <Shield size={22} />
                  <span>Novos / Saidas</span>
                  <strong>{memberStats?.newMemberCount ?? 0}/{memberStats?.leaveCount ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <RadioTower size={22} />
                  <span>Alertas Twitch ativos</span>
                  <strong>{overview?.counters.activeTwitchChannels ?? activeAlerts}</strong>
                </article>
                <article className="stat-card">
                  <Bell size={22} />
                  <span>Notificacoes sociais</span>
                  <strong>{overview?.counters.socialNotifications ?? socialConfigs.filter((config) => config.enabled).length}</strong>
                </article>
                <article className="stat-card">
                  <Twitch size={22} />
                  <span>Subs Twitch ativos</span>
                  <strong>{overview?.counters.activeSubs ?? subStats.filter((item) => item.active).reduce((total, item) => total + item._count._all, 0)}</strong>
                </article>
                <article className="stat-card">
                  <Server size={22} />
                  <span>Servidores admin</span>
                  <strong>{guilds.length}</strong>
                </article>
              </section>

              <CategorySection title="Configuracoes" description="Ajustes principais do painel e integrações ativas.">
                <ConfigCard
                  icon={RadioTower}
                  title="Alertas de live"
                  description="Cadastre canais, escolha destinos e controle os avisos enviados pelo bot."
                  action="Abrir"
                  badge={`${alerts.length} item(ns)`}
                  onClick={() => setPage("alerts")}
                />
                <ConfigCard
                  icon={Twitch}
                  title="Subs Twitch"
                  description="Configure cargos por tier, vinculos Twitch e verificacao automatica de inscritos."
                  action="Configurar"
                  badge={`${subStats.filter((item) => item.active).reduce((total, item) => total + item._count._all, 0)} ativo(s)`}
                  onClick={() => setPage("subs")}
                />
                <ConfigCard
                  icon={Bell}
                  title="Social Notifications"
                  description="Controle mensagens, embeds, cargos e botoes para Twitch, YouTube, TikTok e Kick."
                  action="Abrir"
                  badge={`${socialConfigs.filter((config) => config.enabled).length} ativo(s)`}
                  onClick={() => setPage("social")}
                />
              </CategorySection>

              <CategorySection title="Permissoes" description="Controle de servidores, canais e acesso administrativo.">
                <ConfigCard
                  icon={Server}
                  title="Servidores conectados"
                  description="Selecione o servidor que sera administrado e valide as permissões disponíveis."
                  action="Ver"
                  badge={`${guilds.length} servidor(es)`}
                  onClick={() => setPage("settings")}
                />
                <ConfigCard
                  icon={Hash}
                  title="Canais de texto"
                  description="Confira canais elegíveis para alertas, logs e mensagens automáticas."
                  action="Listar"
                  badge={`${channels.length} canal(is)`}
                  onClick={() => setPage("channels")}
                />
              </CategorySection>

              <CategorySection title="Modulos" description="Espacos preparados para futuras funções do bot.">
                <ConfigCard
                  icon={Settings}
                  title="Personalizacao"
                  description="Area reservada para identidade visual, mensagens e comportamento do painel."
                  action="Preparado"
                  badge="Em breve"
                  onClick={() => setPage("settings")}
                />
                <ConfigCard
                  icon={Bell}
                  title="Logs e auditoria"
                  description="Historico de vinculos, sincronizacoes, erros e ações importantes do sistema."
                  action="Abrir"
                  badge={`${latestLogs.length} log(s)`}
                  onClick={() => setPage("logs")}
                />
              </CategorySection>
            </>
          ) : null}

          {page === "alerts" ? (
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Twitch / Lives</p>
                  <h2>Canais cadastrados</h2>
                </div>
                <button className="primary-button" type="button" onClick={openCreateModal} disabled={!selectedGuildId || !channels.length}>
                  <Plus size={18} />
                  Adicionar Canal
                </button>
              </div>

              <div className="table-list">
                {alerts.length ? (
                  alerts.map((alert) => {
                    const channel = channels.find((item) => item.id === alert.textChannelId);

                    return (
                      <article className="alert-row" key={alert.id}>
                        <div className="streamer-cell">
                          <div className="avatar-box">
                            {alert.twitchAvatarUrl ? <img src={alert.twitchAvatarUrl} alt="" /> : <Twitch size={18} />}
                          </div>
                          <div>
                            <strong>{alert.streamerName}</strong>
                            <span>{alert.streamerUrl}</span>
                          </div>
                        </div>
                        <div className="muted-cell">#{channel?.name || alert.textChannelId}</div>
                        <button className={`status-pill ${alert.enabled ? "on" : ""}`} type="button" onClick={() => toggleAlert(alert)}>
                          {alert.enabled ? "Ativado" : "Desativado"}
                        </button>
                        <div className="row-actions">
                          <button className="icon-button" type="button" onClick={() => openEditModal(alert)} aria-label="Editar">
                            <Pencil size={17} />
                          </button>
                          <button className="icon-button danger" type="button" onClick={() => deleteAlert(alert)} aria-label="Excluir">
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <small>Atualizado {formatDate(alert.updatedAt)}</small>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <Twitch size={28} />
                    <strong>Nenhum canal cadastrado</strong>
                    <span>Adicione um canal da Twitch para o bot enviar o alerta quando a live comecar.</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {page === "social" ? (
            <SocialNotificationsView
              configs={socialConfigs}
              channels={channels}
              roles={roles}
              selectedPlatform={selectedSocialPlatform}
              draft={socialDraft}
              saving={saving}
              onSelect={setSelectedSocialPlatform}
              onDraft={setSocialDraft}
              onSave={saveSocialConfig}
            />
          ) : null}

          {page === "logs" ? (
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Logs</p>
                  <h2>Eventos sincronizados</h2>
                </div>
                <span className={`connection-pill ${socketConnected ? "online" : ""}`}>
                  {socketConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                  Tempo real
                </span>
              </div>

              <div className="log-list">
                {latestLogs.length ? (
                  latestLogs.map((log) => (
                    <article className="log-row" key={log.id}>
                      <strong>{log.action}</strong>
                      <span>{log.message}</span>
                      <small>{formatDate(log.createdAt)}</small>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <Activity size={28} />
                    <strong>Nenhum log ainda</strong>
                    <span>Entradas, saidas, banimentos, cargos e configuracoes aparecem aqui em tempo real.</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {page === "channels" ? (
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Canais</p>
                  <h2>Canais de texto disponiveis</h2>
                </div>
              </div>
              <div className="channel-grid">
                {channels.map((channel) => (
                  <article className="channel-card" key={channel.id}>
                    <Hash size={18} />
                    <strong>{channel.name}</strong>
                    <span>{channel.id}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {page === "subs" ? (
            <TwitchSubsView
              config={{ ...subConfig, guildId: selectedGuildId }}
              roles={roles}
              channels={channels}
              logs={subLogs}
              stats={subStats}
              saving={saving}
              onConfig={setSubConfig}
              onSave={saveSubConfig}
              onConnectBroadcaster={() => {
                window.location.href = apiPath(`/api/twitch-subs/broadcaster/oauth?guildId=${selectedGuildId}`);
              }}
              onSync={syncSubsNow}
            />
          ) : null}

          {page === "settings" ? (
            <section className="panel-card settings-card">
              <Settings size={28} />
              <div>
                <p className="eyebrow">Configuracoes</p>
                <h2>Permissoes protegidas</h2>
                <span>
                  O painel lista somente servidores onde sua conta Discord possui permissao de administrador. As rotas
                  do backend validam essa permissao novamente antes de salvar qualquer alerta.
                </span>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <AlertModal
          form={form}
          channels={channels}
          roles={roles}
          saving={saving}
          onChange={setForm}
          onClose={() => setModalOpen(false)}
          onSave={saveAlert}
        />
      ) : null}
    </main>
  );
}
