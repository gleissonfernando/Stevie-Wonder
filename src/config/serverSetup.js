const { ChannelType, PermissionFlagsBits } = require("discord.js");

const roleDefinitions = [
  {
    name: "👑 Fundador",
    color: 0xef4444,
    permissions: [PermissionFlagsBits.Administrator]
  },
  {
    name: "🛡️ Administrador",
    color: 0xf97316,
    permissions: [
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageEvents,
      PermissionFlagsBits.ManageWebhooks
    ]
  },
  {
    name: "⚔️ Moderador",
    color: 0xeab308,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageNicknames
    ]
  },
  {
    name: "🎫 Suporte",
    color: 0x38bdf8,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory
    ]
  },
  {
    name: "🎬 Editor",
    color: 0xec4899,
    permissions: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ]
  },
  {
    name: "📢 Divulgador",
    color: 0x22c55e,
    permissions: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ]
  },
  {
    name: "💜 VIP",
    color: 0xa855f7,
    permissions: []
  },
  {
    name: "🤖 Bot",
    color: 0x5865f2,
    permissions: []
  },
  {
    name: "🎮 Membro",
    color: 0x94a3b8,
    permissions: []
  }
];

const categoryDefinitions = [
  {
    name: "🚀 COMECE AQUI",
    channels: [
      { name: "🚀・bem-vindo", type: ChannelType.GuildText },
      { name: "📜・regras", type: ChannelType.GuildText },
      { name: "🎫・cargos", type: ChannelType.GuildText },
      { name: "📢・anuncios", type: ChannelType.GuildText }
    ]
  },
  {
    name: "🎥 RICARDINN98",
    channels: [
      { name: "🔴・ao-vivo", type: ChannelType.GuildText },
      { name: "📅・agenda-live", type: ChannelType.GuildText },
      { name: "📢・novidades", type: ChannelType.GuildText },
      { name: "🎬・clips-da-live", type: ChannelType.GuildText },
      { name: "⭐・highlights", type: ChannelType.GuildText },
      { name: "📱・redes-sociais", type: ChannelType.GuildText }
    ]
  },
  {
    name: "💬 COMUNIDADE",
    channels: [
      { name: "💬・chat-geral", type: ChannelType.GuildText },
      { name: "📸・midia", type: ChannelType.GuildText },
      { name: "😂・memes", type: ChannelType.GuildText },
      { name: "🎮・games", type: ChannelType.GuildText },
      { name: "🎵・musicas", type: ChannelType.GuildText },
      { name: "🐾・pets", type: ChannelType.GuildText }
    ]
  },
  {
    name: "🎉 INTERAÇÃO",
    channels: [
      { name: "🎁・sorteios", type: ChannelType.GuildText },
      { name: "🎯・desafios", type: ChannelType.GuildText },
      { name: "📊・enquetes", type: ChannelType.GuildText },
      { name: "💡・sugestoes", type: ChannelType.GuildText }
    ]
  },
  {
    name: "🤖 SISTEMAS",
    channels: [
      { name: "📌・comandos", type: ChannelType.GuildText },
      { name: "🎫・tickets", type: ChannelType.GuildText },
      { name: "📈・status-bot", type: ChannelType.GuildText }
    ]
  },
  {
    name: "🎙️ VOZ",
    channels: [
      { name: "🎙️・geral", type: ChannelType.GuildVoice },
      { name: "🎮・jogando", type: ChannelType.GuildVoice },
      { name: "🎥・assistindo-live", type: ChannelType.GuildVoice },
      { name: "🎬・cinema-dos-cria", type: ChannelType.GuildVoice },
      { name: "💜・vip", type: ChannelType.GuildVoice, vipOnly: true },
      { name: "➕・criar-sala", type: ChannelType.GuildVoice, temporaryCreator: true }
    ]
  },
  {
    name: "👑 EQUIPE",
    staffOnly: true,
    channels: [
      { name: "📋・logs", type: ChannelType.GuildText },
      { name: "⚠️・punicoes", type: ChannelType.GuildText },
      { name: "📊・relatorios", type: ChannelType.GuildText },
      { name: "🔒・staff-chat", type: ChannelType.GuildText },
      { name: "📈・frequencia", type: ChannelType.GuildText }
    ]
  }
];

module.exports = {
  categoryDefinitions,
  roleDefinitions
};
