const { Events } = require("discord.js");
const { PermissionFlagsBits } = require("discord.js");
const { getModuleConfig } = require("../../services/dashboard/configStore");
const logger = require("../../utils/logger");

async function runComponent(interaction, collection) {
  const component = collection.get(interaction.customId) || collection.get(interaction.customId.split(":")[0]);
  if (!component) return false;

  await component.execute(interaction, interaction.client);
  return true;
}

async function replyDenied(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

async function canRunCommand(interaction) {
  if (!interaction.guildId) return true;

  const commandConfig = await getModuleConfig("commands", interaction.guildId).catch(() => null);
  const item = commandConfig?.commands?.find((command) => command.name === interaction.commandName);
  if (!item) return true;

  if (item.enabled === false) {
    await replyDenied(interaction, "Este comando esta desativado neste servidor.");
    return false;
  }

  if (item.allowedChannelId && item.allowedChannelId !== interaction.channelId) {
    await replyDenied(interaction, "Este comando so pode ser usado no canal configurado.");
    return false;
  }

  if (item.allowedRoleId && !interaction.member?.roles?.cache?.has(item.allowedRoleId)) {
    await replyDenied(interaction, "Voce nao tem o cargo necessario para usar este comando.");
    return false;
  }

  if (item.requiredPermission && PermissionFlagsBits[item.requiredPermission]) {
    const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits[item.requiredPermission]);
    if (!hasPermission) {
      await replyDenied(interaction, "Voce nao tem permissao para usar este comando.");
      return false;
    }
  }

  return true;
}

async function handleDashboardVerification(interaction) {
  const [, guildId, roleId] = interaction.customId.split(":");
  if (!guildId || !roleId || guildId !== interaction.guildId) return false;

  const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await replyDenied(interaction, "Nao consigo entregar cargos neste servidor.");
    return true;
  }

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role || role.position >= botMember.roles.highest.position) {
    await replyDenied(interaction, "Cargo de verificacao invalido ou acima do cargo do bot.");
    return true;
  }

  await interaction.member.roles.add(role, "Verificacao pelo Ricardinn98 Dashboard");
  await replyDenied(interaction, "Verificacao concluida com sucesso.");
  return true;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (!(await canRunCommand(interaction))) return;

        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith("dashboard_verify:")) {
          if (await handleDashboardVerification(interaction)) return;
        }

        await runComponent(interaction, client.buttons);
        return;
      }

      if (interaction.isModalSubmit()) {
        await runComponent(interaction, client.modals);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await runComponent(interaction, client.selectMenus);
      }
    } catch (error) {
      logger.error("Erro ao processar interacao", error);

      const payload = {
        content: "Ocorreu um erro ao executar essa acao.",
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  }
};
