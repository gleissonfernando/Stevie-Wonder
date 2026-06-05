const {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  TextDisplayBuilder
} = require("@discordjs/builders");
const { ButtonStyle, SeparatorSpacingSize } = require("discord.js");

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isConfiguredGif(url) {
  return isValidUrl(url) && !url.includes("COLE_O_LINK_DO_GIF_AQUI");
}

function resolveGifUrl(config) {
  if (isConfiguredGif(config.gifUrl)) return config.gifUrl;
  if (config.gifAttachmentName) return `attachment://${config.gifAttachmentName}`;
  return "";
}

function formatJoinDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function buildButton(label, emoji, url) {
  if (!isValidUrl(url)) return null;

  return new ButtonBuilder()
    .setLabel(label)
    .setEmoji({ name: emoji })
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function buildWelcomeButtons(config) {
  const buttons = [
    buildButton("Regras", "\uD83D\uDCDC", config.buttons.rulesUrl),
    buildButton("Suporte", "\uD83C\uDFAB", config.buttons.supportUrl)
  ].filter(Boolean);

  if (!buttons.length) return null;

  return new ActionRowBuilder().addComponents(...buttons).toJSON();
}

function buildWelcomeComponents(member, config) {
  const gifUrl = resolveGifUrl(config);
  const hasGif = Boolean(gifUrl);

  const intro = [
    `## \uD83D\uDC7E ${member.guild.name}`,
    `Seja bem-vindo(a), <@${member.id}>, a nossa comunidade de lives.`,
    "Aqui a galera acompanha transmissoes, eventos da comunidade, avisos e momentos ao vivo juntos.",
    "",
    "**Algumas dicas:**",
    "`1.` Leia as regras antes de participar.",
    "`2.` Aguarde os avisos oficiais de lives e eventos.",
    "`3.` Respeite streamers, espectadores e moderadores.",
    "`4.` Nao divulgue lives, links ou canais sem autorizacao.",
    "`5.` Converse, faca amizades e aproveite sua estadia."
  ].join("\n");

  const footerLines = [];
  if (config.liveChannelId) {
    footerLines.push(`\uD83D\uDD17 Acesse o canal: <#${config.liveChannelId}>`, "");
  }
  footerLines.push(`-# ${member.guild.name} - Comunidade de lives`);
  const footer = footerLines.join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(config.theme.accentColor);

  if (hasGif) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(gifUrl)
          .setDescription(`Boas-vindas de ${member.guild.name}`)
      )
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(intro))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

  return [container.toJSON()];
}

module.exports = {
  buildWelcomeComponents,
  formatJoinDate,
  isConfiguredGif,
  isValidUrl,
  resolveGifUrl
};
