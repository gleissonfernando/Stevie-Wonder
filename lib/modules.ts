import type { ModuleDefinition } from "./types";

export const moduleDefinitions: ModuleDefinition[] = [
  {
    key: "twitch",
    path: "twitch",
    title: "Alertas de live",
    description: "Configure os alertas automaticos da Twitch.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar sistema", kind: "toggle" },
      { name: "twitchChannel", label: "Nome do canal da Twitch", kind: "text", placeholder: "ricardinn98" },
      { name: "discordChannelId", label: "Canal do Discord", kind: "channel" },
      { name: "mentionRoleId", label: "Cargo para mencionar", kind: "role" },
      { name: "message", label: "Mensagem personalizada", kind: "textarea" },
      { name: "bannerUrl", label: "Imagem/banner do alerta", kind: "text" },
      { name: "embedColor", label: "Cor do embed", kind: "color" },
      { name: "intervalMinutes", label: "Intervalo de verificacao", kind: "number" }
    ]
  },
  {
    key: "welcome",
    path: "welcome",
    title: "Boas-vindas",
    description: "Mensagem de entrada e cargo automatico.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar boas-vindas", kind: "toggle" },
      { name: "channelId", label: "Canal de boas-vindas", kind: "channel" },
      { name: "message", label: "Mensagem personalizada", kind: "textarea" },
      { name: "embedEnabled", label: "Embed ativado", kind: "toggle" },
      { name: "embedColor", label: "Cor do embed", kind: "color" },
      { name: "imageUrl", label: "Imagem personalizada", kind: "text" },
      { name: "autoRoleId", label: "Cargo automatico ao entrar", kind: "role" }
    ]
  },
  {
    key: "leave",
    path: "leave",
    title: "Saidas",
    description: "Mensagem quando alguem sair do servidor.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar saidas", kind: "toggle" },
      { name: "channelId", label: "Canal de saida", kind: "channel" },
      { name: "message", label: "Mensagem personalizada", kind: "textarea" },
      { name: "embedEnabled", label: "Embed ativado", kind: "toggle" },
      { name: "embedColor", label: "Cor do embed", kind: "color" },
      { name: "imageUrl", label: "Imagem personalizada", kind: "text" }
    ]
  },
  {
    key: "logs",
    path: "logs",
    title: "Logs",
    description: "Canal e eventos de auditoria do servidor.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar logs", kind: "toggle" },
      { name: "channelId", label: "Canal de logs", kind: "channel" },
      { name: "embedColor", label: "Cor dos embeds", kind: "color" },
      { name: "mentionAdminRole", label: "Mencionar cargo administrativo", kind: "toggle" },
      { name: "adminRoleId", label: "Cargo administrativo", kind: "role" },
      { name: "events.memberJoin", label: "Entrada de membros", kind: "toggle" },
      { name: "events.memberLeave", label: "Saida de membros", kind: "toggle" },
      { name: "events.messageDelete", label: "Mensagens apagadas", kind: "toggle" },
      { name: "events.messageUpdate", label: "Mensagens editadas", kind: "toggle" },
      { name: "events.bans", label: "Banimentos", kind: "toggle" },
      { name: "events.kicks", label: "Expulsoes", kind: "toggle" },
      { name: "events.roleAdd", label: "Cargos adicionados", kind: "toggle" },
      { name: "events.roleRemove", label: "Cargos removidos", kind: "toggle" },
      { name: "events.channelCreate", label: "Canais criados", kind: "toggle" },
      { name: "events.channelDelete", label: "Canais deletados", kind: "toggle" },
      { name: "events.guildUpdate", label: "Alteracoes no servidor", kind: "toggle" },
      { name: "events.panelChanges", label: "Configuracoes alteradas no painel", kind: "toggle" }
    ]
  },
  {
    key: "roles",
    path: "roles",
    title: "Cargos automaticos",
    description: "Cargos de entrada, verificacao, VIP e temporarios.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar cargos automaticos", kind: "toggle" },
      { name: "joinRoleId", label: "Cargo ao entrar", kind: "role" },
      { name: "verificationRoleId", label: "Cargo por verificacao", kind: "role" },
      { name: "twitchSubRoleId", label: "Cargo por sub da Twitch", kind: "role" },
      { name: "vipRoleId", label: "Cargo VIP", kind: "role" },
      { name: "removableRoleId", label: "Cargo removivel", kind: "role" },
      { name: "temporaryRoleId", label: "Cargo temporario", kind: "role" },
      { name: "temporaryMinutes", label: "Tempo do cargo temporario", kind: "number" }
    ]
  },
  {
    key: "verification",
    path: "verification",
    title: "Verificacao",
    description: "Painel com botao para liberar cargo no Discord.",
    statusField: "enabled",
    fields: [
      { name: "enabled", label: "Ativar verificacao", kind: "toggle" },
      { name: "channelId", label: "Canal da verificacao", kind: "channel" },
      { name: "roleId", label: "Cargo entregue", kind: "role" },
      { name: "panelMessage", label: "Mensagem do painel", kind: "textarea" },
      { name: "title", label: "Titulo do embed", kind: "text" },
      { name: "description", label: "Descricao", kind: "textarea" },
      { name: "embedColor", label: "Cor", kind: "color" },
      { name: "buttonText", label: "Texto do botao", kind: "text" },
      { name: "buttonEmoji", label: "Emoji do botao", kind: "text" }
    ]
  },
  {
    key: "commands",
    path: "commands",
    title: "Comandos",
    description: "Controle comandos, canais permitidos, cargos e permissoes.",
    fields: []
  },
  {
    key: "appearance",
    path: "appearance",
    title: "Aparencia",
    description: "Personalizacao visual por servidor.",
    fields: [
      { name: "primaryColor", label: "Cor principal", kind: "color" },
      { name: "secondaryColor", label: "Cor secundaria", kind: "color" },
      { name: "logoUrl", label: "Logo do servidor", kind: "text" },
      { name: "bannerUrl", label: "Banner personalizado", kind: "text" },
      { name: "backgroundUrl", label: "Imagem de fundo", kind: "text" },
      { name: "panelName", label: "Nome personalizado do painel", kind: "text" }
    ]
  },
  {
    key: "config",
    path: "settings",
    title: "Configuracoes",
    description: "Preferencias gerais do bot e do painel.",
    fields: [
      { name: "prefix", label: "Prefixo do bot", kind: "text" },
      { name: "language", label: "Idioma", kind: "select", options: [{ label: "Portugues do Brasil", value: "pt-BR" }] },
      { name: "timezone", label: "Timezone", kind: "text" },
      { name: "defaultChannelId", label: "Canal padrao", kind: "channel" },
      { name: "adminRoles", label: "Cargo administrador do painel", kind: "role" }
    ]
  }
];

export const moduleByKey = Object.fromEntries(moduleDefinitions.map((item) => [item.key, item])) as Record<string, ModuleDefinition>;
export const moduleByPath = Object.fromEntries(moduleDefinitions.map((item) => [item.path, item])) as Record<string, ModuleDefinition>;
