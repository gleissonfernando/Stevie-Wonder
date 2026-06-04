import {
  Bell,
  Bot,
  CheckCircle2,
  Hash,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Server,
  Settings,
  Trash2,
  Twitch,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Page = "home" | "alerts" | "subs" | "channels" | "settings";

type AuthUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

type Guild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
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
  customMessage: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type AlertForm = {
  id?: string;
  streamerUrl: string;
  textChannelId: string;
  customMessage: string;
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

const defaultMessage = "@everyone";

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
    { id: "subs" as const, label: "Subs Twitch", icon: Twitch },
    { id: "channels" as const, label: "Canais", icon: Hash },
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
  saving,
  onChange,
  onClose,
  onSave
}: {
  form: AlertForm;
  channels: TextChannel[];
  saving: boolean;
  onChange: (form: AlertForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
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
            placeholder="https://www.twitch.tv/usuario"
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
          <span>Mensagem personalizada do alerta</span>
          <textarea
            rows={5}
            value={form.customMessage}
            onChange={(event) => onChange({ ...form, customMessage: event.target.value })}
          />
        </label>

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

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [channels, setChannels] = useState<TextChannel[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
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
  const [form, setForm] = useState<AlertForm>({
    streamerUrl: "",
    textChannelId: "",
    customMessage: defaultMessage,
    enabled: true
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGuild = useMemo(
    () => guilds.find((guild) => guild.id === selectedGuildId) || null,
    [guilds, selectedGuildId]
  );

  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.enabled).length, [alerts]);

  async function loadSession() {
    setLoading(true);
    setError("");

    try {
      const session = await apiJson<{ user: AuthUser }>("/api/auth/me", { cache: "no-store" });
      setUser(session.user);
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
      return;
    }

    setError("");

    try {
      const [channelData, alertData] = await Promise.all([
        apiJson<{ channels: TextChannel[] }>(`/api/lives/guilds/${guildId}/channels`, { cache: "no-store" }),
        apiJson<{ alerts: LiveAlert[] }>(`/api/lives?guildId=${guildId}`, { cache: "no-store" })
      ]);
      setChannels(channelData.channels);
      setAlerts(alertData.alerts);
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
    loadSession();
  }, []);

  useEffect(() => {
    if (user) {
      loadGuildData(selectedGuildId);
    }
  }, [selectedGuildId, user]);

  function openCreateModal() {
    setForm({
      streamerUrl: "",
      textChannelId: channels[0]?.id || "",
      customMessage: defaultMessage,
      enabled: true
    });
    setModalOpen(true);
  }

  function openEditModal(alert: LiveAlert) {
    setForm({
      id: alert.id,
      streamerUrl: alert.streamerUrl,
      textChannelId: alert.textChannelId,
      customMessage: alert.customMessage,
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
        customMessage: form.customMessage,
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

  async function logout() {
    await fetch(authPath("/logout"), { method: "POST", credentials: "include" }).catch(() => null);
    setUser(null);
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={30} />
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
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>{page === "alerts" ? "Alertas de Live" : page === "subs" ? "Subs Twitch" : "Painel de Controle"}</h1>
          </div>
          <div className="topbar-right">
            <Bell size={18} />
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
          </div>
        </header>

        <div className="content">
          {error ? <div className="toast error">{error}</div> : null}
          {message ? <div className="toast success">{message}</div> : null}

          {page === "home" ? (
            <>
              <section className="stats-grid">
                <article className="stat-card">
                  <RadioTower size={22} />
                  <span>Alertas cadastrados</span>
                  <strong>{alerts.length}</strong>
                </article>
                <article className="stat-card">
                  <CheckCircle2 size={22} />
                  <span>Alertas ativos</span>
                  <strong>{activeAlerts}</strong>
                </article>
                <article className="stat-card">
                  <Server size={22} />
                  <span>Servidores admin</span>
                  <strong>{guilds.length}</strong>
                </article>
                <article className="stat-card">
                  <Twitch size={22} />
                  <span>Subs Twitch ativos</span>
                  <strong>{subStats.filter((item) => item.active).reduce((total, item) => total + item._count._all, 0)}</strong>
                </article>
              </section>

              <section className="hero-band">
                <div>
                  <p className="eyebrow">Servidor selecionado</p>
                  <h2>{selectedGuild?.name || "Selecione um servidor"}</h2>
                  <span>Configure alertas da Twitch com envio automatico em canais de texto do Discord.</span>
                </div>
                <button className="primary-button" type="button" onClick={() => setPage("alerts")}>
                  <RadioTower size={18} />
                  Abrir alertas
                </button>
                <button className="secondary-button" type="button" onClick={() => setPage("subs")}>
                  <Twitch size={18} />
                  Subs Twitch
                </button>
              </section>
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
          saving={saving}
          onChange={setForm}
          onClose={() => setModalOpen(false)}
          onSave={saveAlert}
        />
      ) : null}
    </main>
  );
}
