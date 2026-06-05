const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const next = require("next");
const { Server } = require("socket.io");
const { createBotBridge } = require("../services/dashboard/botBridge");
const { verifySessionToken } = require("../services/dashboard/auth");
const { setupDashboardApi } = require("./api");
const logger = require("../utils/logger");

function parseCookieHeader(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index > -1) {
        cookies[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
      }
      return cookies;
    }, {});
}

function resolveListenConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const fallbackPort = isProduction ? 80 : 3000;
  const rawPort = process.env.PORT || (!isProduction ? process.env.API_PORT || process.env.SOCKET_PORT : "") || fallbackPort;
  const port = Number(rawPort);

  return {
    host: process.env.HOST || "0.0.0.0",
    port: Number.isFinite(port) && port > 0 ? port : fallbackPort
  };
}

function ensureProductionBuild() {
  if (process.env.NODE_ENV !== "production") return;

  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  if (fs.existsSync(buildIdPath)) return;

  logger.warn("Build do Next.js nao encontrado. Executando npm run build antes de iniciar o dashboard.");

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "build"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm run build falhou com codigo ${result.status}.`);
  }
}

async function startDashboardServer(client) {
  if (process.env.DASHBOARD_ENABLED === "false") {
    logger.info("Dashboard web desativado por DASHBOARD_ENABLED=false.");
    return null;
  }

  const dev = process.env.NODE_ENV !== "production";
  const { host, port } = resolveListenConfig();

  ensureProductionBuild();

  const nextApp = next({ dev, dir: process.cwd() });
  const nextHandler = nextApp.getRequestHandler();

  await nextApp.prepare();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });
  const botBridge = createBotBridge(client, io);

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString("utf8");
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  io.use(async (socket, nextSocket) => {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const session = await verifySessionToken(cookies.ricardinn98_session);
    if (!session) {
      nextSocket(new Error("Sessao invalida."));
      return;
    }

    socket.dashboardSession = session;
    nextSocket();
  });

  io.on("connection", (socket) => {
    socket.emit("bot:status", require("../services/dashboard/configStore").getBotStatus(client, botBridge.startedAt, io.engine.clientsCount));

    socket.on("guild:join", (guildId) => {
      if (typeof guildId === "string" && client.guilds.cache.has(guildId)) {
        socket.join(`guild:${guildId}`);
      }
    });

    socket.on("guild:leave", (guildId) => {
      if (typeof guildId === "string") {
        socket.leave(`guild:${guildId}`);
      }
    });
  });

  setupDashboardApi(app, { botBridge, client, io });

  app.use((req, res) => nextHandler(req, res));

  await new Promise((resolve) => {
    server.listen(port, host, resolve);
  });

  botBridge.start();
  logger.info(`Dashboard Ricardinn98 online em http://${host}:${port}.`);

  return { app, botBridge, host, io, port, server };
}

module.exports = {
  ensureProductionBuild,
  resolveListenConfig,
  startDashboardServer
};
