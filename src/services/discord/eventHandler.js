const path = require("path");
const { getJsFiles } = require("./fileLoader");
const logger = require("../../utils/logger");

function loadEvents(client) {
  const eventsPath = path.join(process.cwd(), "src", "events");
  const eventFiles = getJsFiles(eventsPath);

  for (const file of eventFiles) {
    delete require.cache[require.resolve(file)];
    const event = require(file);

    if (!event.name || typeof event.execute !== "function") {
      logger.warn(`Evento ignorado por formato invalido: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  logger.info(`${eventFiles.length} evento(s) carregado(s).`);
}

module.exports = {
  loadEvents
};
