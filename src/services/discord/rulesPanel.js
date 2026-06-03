const fs = require("fs");
const path = require("path");
const { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } = require("@discordjs/builders");
const { ChannelType } = require("discord.js");
const { MessageFlags, SeparatorSpacingSize } = require("discord-api-types/v10");
const logger = require("../../utils/logger");

const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID || "";
const STATE_FILE = path.join(process.cwd(), "database", "rules-panel.json");
const PANEL_ACCENT_COLOR = 0x7c3aed;

function ensureStateDir() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (error) {
    logger.warn(`Nao foi possivel ler o registro do painel de regras: ${error.message}`);
    return {};
  }
}

function writeState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function clearRulesPanelState() {
  writeState({});
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function separator() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Large);
}

function buildRulesPanelPayload() {
  const container = new ContainerBuilder()
    .setAccentColor(PANEL_ACCENT_COLOR)
    .addTextDisplayComponents(text([
      "## 💜 Regras",
      "",
      "Leia com atenção as regras do servidor Ricardinho. Elas mantêm a comunidade organizada, leve e segura para todos.",
      "",
      "### 📌 Diretrizes de Comportamento",
      "",
      "`1` Respeite todos os membros, moderadores e criadores;",
      "`2` Siga os [Termos de Serviço do Discord](https://discord.com/terms);",
      "`3` Siga as [Diretrizes da Comunidade do Discord](https://discord.com/guidelines);",
      "`4` Use bom senso e evite provocações, brigas ou ofensas."
    ].join("\n")))
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text([
      "### 💬 Proibido em canais de texto",
      "",
      "> Conteúdo pornográfico, +18 ou sensível;",
      "> Flood, spam, mensagens repetidas ou textos enormes;",
      "> Racismo, homofobia, discriminação ou preconceito;",
      "> Plágio de conteúdo do servidor;",
      "> Divulgação sem autorização da equipe;",
      "> Marcação excessiva de membros ou cargos;",
      "> Exposição de dados, fotos ou informações pessoais;",
      "> Links suspeitos, golpes ou arquivos maliciosos."
    ].join("\n")))
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text([
      "### 🎙️ Proibido em canais de voz",
      "",
      "> Usar modificadores de voz para incomodar;",
      "> Gritar, ofender ou iniciar discussões;",
      "> Colocar sons altos, irritantes ou repetitivos;",
      "> Usar bots de música para atrapalhar;",
      "> Entrar e sair repetidamente para incomodar calls.",
      "",
      "### 🛡️ Punições",
      "",
      "> A equipe poderá aplicar advertência, timeout, kick ou banimento conforme a gravidade.",
      "",
      "© Ricardinho • Regras do Servidor"
    ].join("\n")));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  };
}

function isSendableGuildTextChannel(channel) {
  return Boolean(channel?.isTextBased?.()) && channel.type !== ChannelType.DM;
}

async function fetchRulesChannel(client) {
  if (!RULES_CHANNEL_ID) {
    throw new Error("RULES_CHANNEL_ID nao configurado.");
  }

  const channel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
  if (!isSendableGuildTextChannel(channel)) {
    throw new Error(`Canal de regras ${RULES_CHANNEL_ID} nao encontrado ou nao enviavel.`);
  }

  return channel;
}

async function fetchStoredPanelMessage(channel) {
  const state = readState();
  if (!state.messageId) return null;

  return channel.messages.fetch(state.messageId).catch(() => null);
}

async function sendNewRulesPanel(client) {
  const channel = await fetchRulesChannel(client);
  const message = await channel.send(buildRulesPanelPayload());

  writeState({
    channelId: RULES_CHANNEL_ID,
    messageId: message.id,
    updatedAt: new Date().toISOString()
  });

  logger.info(`Painel de regras enviado em ${RULES_CHANNEL_ID}: ${message.id}`);
  return message;
}

async function ensureRulesPanel(client, options = {}) {
  const { forceNew = false, updateExisting = true } = options;
  const channel = await fetchRulesChannel(client);
  const storedMessage = forceNew ? null : await fetchStoredPanelMessage(channel);

  if (storedMessage) {
    if (updateExisting) {
      await storedMessage.edit(buildRulesPanelPayload());
      logger.info(`Painel de regras atualizado: ${storedMessage.id}`);
    }

    return storedMessage;
  }

  return sendNewRulesPanel(client);
}

async function resetRulesPanel(client) {
  const channel = await fetchRulesChannel(client);
  const storedMessage = await fetchStoredPanelMessage(channel);

  if (storedMessage?.deletable) {
    await storedMessage.delete().catch(() => null);
  }

  clearRulesPanelState();
  return sendNewRulesPanel(client);
}

async function handleRulesPanelDelete(message, client) {
  if (message.channelId !== RULES_CHANNEL_ID) return false;

  const state = readState();
  if (!state.messageId || message.id !== state.messageId) return false;

  try {
    clearRulesPanelState();
    await sendNewRulesPanel(client);
  } catch (error) {
    logger.error("Falha ao recriar o painel de regras apos exclusao", error);
  }

  return true;
}

module.exports = {
  RULES_CHANNEL_ID,
  buildRulesPanelPayload,
  clearRulesPanelState,
  ensureRulesPanel,
  handleRulesPanelDelete,
  readState,
  resetRulesPanel
};
