const { PrismaClient } = require("@prisma/client");

const globalForPrisma = global;

const prisma = globalForPrisma.__stevePrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__stevePrisma = prisma;
}

module.exports = prisma;
