import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  REST,
  Routes,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} from "discord.js";
import type { LiveRequest } from "@prisma/client";
import { prisma } from "../prisma";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN || "");

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    TWITCH: "Twitch",
    YOUTUBE: "YouTube",
    KICK: "Kick"
  };

  return labels[platform] || platform;
}

function liveContainer(live: LiveRequest) {
  const header = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        "## Nova solicitacao de live",
        `**${live.liveName}**`,
        `Solicitante: <@${live.discordId}>`
      ].join("\n")
    )
  );

  if (live.discordAvatar) {
    header.setThumbnailAccessory(new ThumbnailBuilder().setURL(live.discordAvatar));
  }

  const details = new TextDisplayBuilder().setContent(
    [
      `**Plataforma:** ${platformLabel(live.platform)}`,
      `**Link:** ${live.liveUrl}`,
      `**Horario:** ${live.startTime}`,
      `**Data da solicitacao:** <t:${Math.floor(live.createdAt.getTime() / 1000)}:f>`,
      "",
      `**Descricao:** ${live.description}`
    ].join("\n")
  );

  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`live:approve:${live.id}`)
      .setLabel("Aprovar Live")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`live:reject:${live.id}`)
      .setLabel("Recusar Live")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`live:change:${live.id}`)
      .setLabel("Solicitar Alteracao")
      .setStyle(ButtonStyle.Secondary)
  );

  return new ContainerBuilder()
    .setAccentColor(0x7c3aed)
    .addSectionComponents(header)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(details)
    .addActionRowComponents(actions);
}

export async function sendLiveRequestToDiscord(live: LiveRequest) {
  const channelId = process.env.DISCORD_LIVE_CHANNEL_ID;

  if (!channelId || !process.env.DISCORD_TOKEN) {
    return;
  }

  const message = (await rest.post(Routes.channelMessages(channelId), {
    body: {
      flags: MessageFlags.IsComponentsV2,
      components: [liveContainer(live).toJSON()]
    }
  })) as { id: string };

  await prisma.liveRequest.update({
    where: { id: live.id },
    data: {
      discordMessageId: message.id,
      discordChannelId: channelId
    }
  });
}
