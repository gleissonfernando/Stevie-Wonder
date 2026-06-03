const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");
const prisma = require("../database/prisma");
const logger = require("../../utils/logger");

function liveIdFrom(customId) {
  return customId.split(":").at(-1);
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function notifySite(discordId, type, payload) {
  const apiUrl = process.env.API_URL;
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!apiUrl || !secret) return;

  try {
    await fetch(`${apiUrl}/bot/live-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret
      },
      body: JSON.stringify({ type, payload, discordId })
    });
  } catch (error) {
    logger.warn(`Nao foi possivel notificar o site: ${error.message}`);
  }
}

async function sendDm(client, discordId, content) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(content);
  } catch (error) {
    logger.warn(`Nao foi possivel enviar DM para ${discordId}: ${error.message}`);
  }
}

async function ensureAdmin(interaction) {
  if (isAdmin(interaction)) return true;

  await interaction.reply({
    content: "Somente administradores podem usar essa acao.",
    ephemeral: true
  });
  return false;
}

async function setMessageDisabled(interaction) {
  const components = interaction.message.components.map((row) => {
    const json = row.toJSON();
    if (json.components) {
      json.components = json.components.map((component) => ({ ...component, disabled: true }));
    }
    return json;
  });

  await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
  customId: "live",
  async execute(interaction, client) {
    if (!(await ensureAdmin(interaction))) return;

    const [scope, action] = interaction.customId.split(":");
    if (scope !== "live") return;

    if (action === "approve") {
      const liveId = liveIdFrom(interaction.customId);
      const live = await prisma.liveRequest.update({
        where: { id: liveId },
        data: { status: "APPROVED", approvedAt: new Date() }
      });

      await prisma.adminLog.create({
        data: {
          action: "LIVE_APPROVED",
          adminId: interaction.user.id,
          adminTag: interaction.user.tag,
          liveId
        }
      });

      await prisma.notification.create({
        data: {
          discordId: live.discordId,
          title: "Live aprovada",
          message: `Sua live "${live.liveName}" foi aprovada.`,
          liveId
        }
      });

      await sendDm(client, live.discordId, `Sua live "${live.liveName}" foi aprovada.`);
      await notifySite(live.discordId, "live.updated", live);
      await setMessageDisabled(interaction);
      await interaction.reply({ content: "Live aprovada com sucesso.", ephemeral: true });
      return;
    }

    if (action === "reject" || action === "change") {
      const liveId = liveIdFrom(interaction.customId);
      const modal = new ModalBuilder()
        .setCustomId(`live:${action}-modal:${liveId}`)
        .setTitle(action === "reject" ? "Motivo da recusa" : "Solicitar alteracao");

      const input = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel(action === "reject" ? "Informe o motivo" : "O que deve ser alterado?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (action === "reject-modal" || action === "change-modal") {
      const liveId = liveIdFrom(interaction.customId);
      const reason = interaction.fields.getTextInputValue("reason");
      const rejected = action === "reject-modal";

      const live = await prisma.liveRequest.update({
        where: { id: liveId },
        data: rejected
          ? { status: "REJECTED", rejectionReason: reason }
          : { status: "CHANGES_REQUESTED", changeRequest: reason }
      });

      await prisma.adminLog.create({
        data: {
          action: rejected ? "LIVE_REJECTED" : "LIVE_CHANGE_REQUESTED",
          adminId: interaction.user.id,
          adminTag: interaction.user.tag,
          liveId,
          metadata: { reason }
        }
      });

      await prisma.notification.create({
        data: {
          discordId: live.discordId,
          title: rejected ? "Live recusada" : "Alteracao solicitada",
          message: reason,
          liveId
        }
      });

      await sendDm(
        client,
        live.discordId,
        rejected
          ? `Sua live "${live.liveName}" foi recusada. Motivo: ${reason}`
          : `Foi solicitada uma alteracao na live "${live.liveName}": ${reason}`
      );

      await notifySite(live.discordId, "live.updated", live);
      await interaction.reply({
        content: rejected ? "Live recusada e usuario notificado." : "Alteracao solicitada e usuario notificado.",
        ephemeral: true
      });
    }
  }
};
