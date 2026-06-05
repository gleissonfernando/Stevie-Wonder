const fs = require("node:fs");
const { AttachmentBuilder, Events, MessageFlags, PermissionsBitField } = require("discord.js");
const welcomeConfig = require("../config/welcome");
const { sendAuditLog } = require("../services/discord/auditLogger");
const { buildWelcomeComponents, isConfiguredGif } = require("../utils/welcomeComponents");
const logger = require("../utils/logger");

function buildWelcomeFiles(config) {
  if (isConfiguredGif(config.gifUrl)) return [];
  if (!config.gifFilePath || !fs.existsSync(config.gifFilePath)) return [];

  return [
    new AttachmentBuilder(config.gifFilePath, {
      name: config.gifAttachmentName || "welcome.gif"
    })
  ];
}

async function assignWelcomeRole(member, config) {
  if (!config.autoRoleId) return;

  const botMember = member.guild.members.me || await member.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.warn(`Sem permissao para adicionar cargos no servidor ${member.guild.id}.`);
    return;
  }

  const role = await member.guild.roles.fetch(config.autoRoleId).catch(() => null);

  if (!role) {
    logger.warn(`Cargo automatico de boas-vindas nao encontrado: ${config.autoRoleId}`);
    return;
  }

  if (role.position >= botMember.roles.highest.position) {
    logger.warn(`Cargo ${role.name} esta acima ou no mesmo nivel do cargo do bot.`);
    return;
  }

  await member.roles.add(role, "Cargo automatico de boas-vindas");
  logger.info(`Cargo ${role.name} adicionado para ${member.user.tag}.`);
}

async function resolveWelcomeChannel(guild, config) {
  const channelById = config.channelId
    ? await guild.channels.fetch(config.channelId).catch(() => null)
    : null;

  if (channelById?.isTextBased()) return channelById;

  const channels = await guild.channels.fetch().catch(() => null);
  const channelByName = channels?.find((channel) => channel?.name === config.channelName && channel.isTextBased());

  return channelByName || null;
}

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member, client) {
    try {
      if (client.dashboard?.botBridge) {
        await client.dashboard.botBridge.assignConfiguredJoinRole(member);
        const sentByDashboard = await client.dashboard.botBridge.sendMemberMessage(member, "welcome");
        if (sentByDashboard) {
          return;
        }
      }

      await assignWelcomeRole(member, welcomeConfig);

      await sendAuditLog(member.guild, {
        title: "Membro entrou",
        action: "member_join",
        counter: "member_join",
        userId: member.id,
        color: 0x22c55e,
        fields: [
          { name: "Usuario", value: `${member.user.tag} (${member.id})` },
          { name: "Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>` }
        ]
      });

      const channel = await resolveWelcomeChannel(member.guild, welcomeConfig);

      if (!channel || !channel.isTextBased()) {
        logger.warn(`Canal de boas-vindas nao encontrado: ${welcomeConfig.channelId} ou ${welcomeConfig.channelName}`);
        return;
      }

      const botMember = member.guild.members.me || await member.guild.members.fetchMe();
      const permissions = channel.permissionsFor(botMember);

      if (!permissions?.has(PermissionsBitField.Flags.SendMessages)) {
        logger.warn(`Sem permissao para enviar mensagens no canal ${channel.name}.`);
        return;
      }

      const files = buildWelcomeFiles(welcomeConfig);

      if (!isConfiguredGif(welcomeConfig.gifUrl) && !files.length) {
        logger.warn("WELCOME_GIF nao configurado e public/assets/welcome.gif nao encontrado. O painel sera enviado sem GIF.");
      }

      const components = buildWelcomeComponents(member, welcomeConfig);

      await channel.send({
        components,
        files,
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          users: [member.id],
          roles: [],
          parse: []
        }
      });

      logger.info(`Mensagem de boas-vindas enviada para ${member.user.tag}.`);
    } catch (error) {
      logger.error("Erro ao enviar mensagem de boas-vindas", error);
    }
  }
};
