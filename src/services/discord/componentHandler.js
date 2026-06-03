const path = require("path");
const { getJsFiles } = require("./fileLoader");
const logger = require("../../utils/logger");

const componentCollections = {
  buttons: "buttons",
  modals: "modals",
  selectMenus: "selectMenus"
};

function loadComponents(client) {
  const basePath = path.join(process.cwd(), "src", "components");
  let loaded = 0;

  for (const [folder, collectionName] of Object.entries(componentCollections)) {
    const files = getJsFiles(path.join(basePath, folder));

    for (const file of files) {
      delete require.cache[require.resolve(file)];
      const component = require(file);

      if (!component.customId || typeof component.execute !== "function") {
        logger.warn(`Componente ignorado por formato invalido: ${file}`);
        continue;
      }

      client[collectionName].set(component.customId, component);
      loaded += 1;
    }
  }

  logger.info(`${loaded} componente(s) carregado(s).`);
}

module.exports = {
  loadComponents
};
