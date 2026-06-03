const path = require("node:path");

// Centraliza tudo que o sistema de boas-vindas precisa para facilitar manutencao.
module.exports = {
  channelId: process.env.WELCOME_CHANNEL_ID || "",
  channelName: process.env.WELCOME_CHANNEL_NAME || "bem-vindo",
  autoRoleId: process.env.WELCOME_AUTO_ROLE_ID || "",
  liveChannelId: process.env.WELCOME_LIVE_CHANNEL_ID || process.env.DISCORD_LIVE_CHANNEL_ID || "",

  // Troque esta variavel no .env sem precisar editar o evento.
  gifUrl: process.env.WELCOME_GIF || "COLE_O_LINK_DO_GIF_AQUI",
  gifFilePath: process.env.WELCOME_GIF_FILE || path.join(__dirname, "..", "..", "public", "assets", "welcome.gif"),
  gifAttachmentName: "welcome.gif",

  // URLs dos botoes. Use links reais apenas no .env local ou no ambiente de deploy.
  buttons: {
    rulesUrl: process.env.WELCOME_RULES_URL || "",
    supportUrl: process.env.WELCOME_SUPPORT_URL || "",
    siteUrl: process.env.WELCOME_SITE_URL || process.env.SITE_URL || ""
  },

  theme: {
    accentColor: 0xef4444
  }
};
