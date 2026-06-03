const mongoose = require("mongoose");
const logger = require("../../utils/logger");

async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    logger.warn("MONGO_URI nao configurado. O bot iniciara sem banco de dados.");
    return null;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("Banco de dados conectado.");
  return mongoose.connection;
}

module.exports = {
  connectDatabase
};
