export type BotStatus = {
  online: boolean;
  status: "Online" | "Offline" | string;
  ping: number;
  uptimeMs: number;
  uptime: string;
  clientId?: string;
  guildCount: number;
  userCount: number;
  commandCount: number;
  mongo: string;
  api: string;
  websocket: string;
  websocketClients: number;
  version: string;
};

export type GuildSummary = {
  id: string;
  name: string;
  icon: string;
  ownerId?: string;
  memberCount: number;
  channelCount?: number;
  roleCount?: number;
  channels?: Array<{ id: string; name: string; type?: number }>;
  roles?: Array<{ id: string; name: string; color?: string; position?: number }>;
  botPresent: boolean;
  lastSyncAt?: string;
};

export type DashboardUser = {
  id: string;
  username: string;
  globalName?: string;
  avatar?: string;
  email?: string;
};

export type ToastKind = "success" | "error" | "warning" | "loading";

export type ModuleKey =
  | "twitch"
  | "welcome"
  | "leave"
  | "logs"
  | "roles"
  | "verification"
  | "commands"
  | "appearance"
  | "config";

export type FieldKind = "text" | "textarea" | "number" | "color" | "toggle" | "channel" | "role" | "select";

export type ModuleField = {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type ModuleDefinition = {
  key: ModuleKey;
  path: string;
  title: string;
  description: string;
  statusField?: string;
  fields: ModuleField[];
};
