const { Events } = require("discord.js");
const { handleTempVoice } = require("../../services/discord/serverSetup");
const logger = require("../../utils/logger");

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      await handleTempVoice(oldState, newState);
    } catch (error) {
      logger.error("Erro no sistema de call temporaria", error);
    }
  }
};
