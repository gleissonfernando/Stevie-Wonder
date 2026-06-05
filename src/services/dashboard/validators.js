const { z } = require("zod");

const snowflake = z.string().trim().max(32).optional().default("");
const text = (max = 500) => z.string().trim().max(max).optional().default("");
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional()
  .default("#3b82f6");
const bool = (fallback = false) => z.coerce.boolean().optional().default(fallback);
const number = (min, max, fallback) => z.coerce.number().min(min).max(max).optional().default(fallback);

const guildConfigSchema = z.object({
  prefix: text(6).default("!"),
  language: text(12).default("pt-BR"),
  timezone: text(80).default("America/Sao_Paulo"),
  defaultChannelId: snowflake,
  adminRoles: z
    .union([z.array(z.string().trim().max(32)), z.string().trim().max(32)])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) return value.filter(Boolean);
      return value ? [value] : [];
    })
});

const twitchAlertSchema = z.object({
  enabled: bool(),
  twitchChannel: text(80),
  discordChannelId: snowflake,
  mentionRoleId: snowflake,
  message: text(1200).default("{user} entrou ao vivo na Twitch!"),
  embedColor: color.default("#8b5cf6"),
  bannerUrl: text(600),
  intervalMinutes: number(1, 120, 5)
});

const welcomeConfigSchema = z.object({
  enabled: bool(),
  channelId: snowflake,
  message: text(1200).default("Bem-vindo(a), {user}! Voce entrou no {server}."),
  embedEnabled: bool(true),
  embedColor: color.default("#22c55e"),
  imageUrl: text(600),
  autoRoleId: snowflake
});

const leaveConfigSchema = z.object({
  enabled: bool(),
  channelId: snowflake,
  message: text(1200).default("{user} saiu do servidor."),
  embedEnabled: bool(true),
  embedColor: color.default("#ef4444"),
  imageUrl: text(600)
});

const logConfigSchema = z.object({
  enabled: bool(),
  channelId: snowflake,
  embedColor: color,
  mentionAdminRole: bool(),
  adminRoleId: snowflake,
  events: z
    .object({
      memberJoin: bool(true),
      memberLeave: bool(true),
      messageDelete: bool(true),
      messageUpdate: bool(true),
      bans: bool(true),
      kicks: bool(true),
      roleAdd: bool(true),
      roleRemove: bool(true),
      channelCreate: bool(true),
      channelDelete: bool(true),
      guildUpdate: bool(true),
      panelChanges: bool(true)
    })
    .optional()
    .default({})
});

const roleConfigSchema = z.object({
  enabled: bool(),
  joinRoleId: snowflake,
  verificationRoleId: snowflake,
  twitchSubRoleId: snowflake,
  vipRoleId: snowflake,
  removableRoleId: snowflake,
  temporaryRoleId: snowflake,
  temporaryMinutes: number(1, 43200, 60)
});

const verificationConfigSchema = z.object({
  enabled: bool(),
  channelId: snowflake,
  roleId: snowflake,
  panelMessage: text(1000).default("Clique no botao abaixo para liberar seu acesso."),
  title: text(120).default("Verificacao"),
  description: text(1200).default("Confirme que voce leu as regras do servidor."),
  embedColor: color,
  buttonText: text(80).default("Verificar"),
  buttonEmoji: text(40),
  messageId: snowflake
});

const commandItemSchema = z.object({
  name: text(80),
  description: text(240),
  category: text(80),
  enabled: bool(true),
  requiredPermission: text(80),
  allowedChannelId: snowflake,
  allowedRoleId: snowflake,
  hiddenWhenDenied: bool()
});

const commandConfigSchema = z.object({
  commands: z.array(commandItemSchema).max(200).optional().default([])
});

const appearanceConfigSchema = z.object({
  primaryColor: color,
  secondaryColor: color.default("#8b5cf6"),
  logoUrl: text(600),
  bannerUrl: text(600),
  backgroundUrl: text(600),
  panelName: text(80).default("Ricardinn98 Dashboard")
});

const noticeSchema = z.object({
  channelId: z.string().trim().min(1).max(32),
  title: text(180),
  description: z.string().trim().min(1).max(1800),
  imageUrl: text(600),
  embedColor: color,
  mentionRoleId: snowflake,
  buttonLabel: text(80),
  buttonUrl: text(600)
});

const schemas = {
  config: guildConfigSchema,
  twitch: twitchAlertSchema,
  welcome: welcomeConfigSchema,
  leave: leaveConfigSchema,
  logs: logConfigSchema,
  roles: roleConfigSchema,
  verification: verificationConfigSchema,
  commands: commandConfigSchema,
  appearance: appearanceConfigSchema
};

function parseModulePayload(moduleName, payload) {
  const schema = schemas[moduleName];
  if (!schema) {
    throw new Error(`Modulo desconhecido: ${moduleName}`);
  }

  return schema.parse(payload || {});
}

module.exports = {
  noticeSchema,
  parseModulePayload,
  schemas
};
