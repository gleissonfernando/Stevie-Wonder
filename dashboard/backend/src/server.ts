import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRoutes } from "./routes/authRoutes";
import { liveRoutes } from "./routes/liveRoutes";
import { realtimeRoutes } from "./routes/realtimeRoutes";
import { socialLiveRoutes } from "./routes/socialLiveRoutes";
import { twitchRoutes } from "./routes/twitchRoutes";
import { twitchSubRoutes } from "./routes/twitchSubRoutes";
import { dashboardRealtimeRoutes } from "./routes/dashboardRealtimeRoutes";
import { env } from "./env";
import { createDashboardSocket } from "./socket/dashboardSocket";

const app = express();
const httpServer = createServer(app);
createDashboardSocket(httpServer);

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set(
        [
          env.siteUrl,
          env.publicSiteUrl,
          "http://localhost:3001",
          "http://localhost:4000"
        ].map((value) => value.replace(/\/+$/, ""))
      );

      if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ""))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida pelo CORS."));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 90 }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, name: "Steve Wonder API" });
});

app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/live-requests", liveRoutes);
app.use("/api/lives", socialLiveRoutes);
app.use("/api/twitch", twitchRoutes);
app.use("/api/twitch-subs", twitchSubRoutes);
app.use("/api/realtime", dashboardRealtimeRoutes);
app.use("/", realtimeRoutes);

const frontendDistPath = path.resolve(process.cwd(), "dashboard/frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

if (fs.existsSync(frontendIndexPath)) {
  app.use(
    express.static(frontendDistPath, {
      setHeaders(response, filePath) {
        if (filePath.endsWith("index.html")) {
          response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          return;
        }

        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    })
  );

  app.get(/.*/, (_request, response) => {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.sendFile(frontendIndexPath);
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Erro interno.";
  const status = message.includes("permissao") || message.includes("permiss") ? 403 : 500;
  response.status(status).json({ error: message });
});

httpServer.listen(env.port, "0.0.0.0", () => {
  console.log(`Steve Wonder API online em http://0.0.0.0:${env.port}`);

  if (process.env.START_DISCORD_BOT !== "false") {
    require("../../../src/index.js");
  }

  if (env.internalWebhookSecret && env.internalWebhookSecret !== "dev-internal-secret") {
    const checkLives = () => {
      fetch(`http://localhost:${env.port}/api/lives/check`, {
        method: "POST",
        headers: { "x-internal-secret": env.internalWebhookSecret }
      }).catch((error) => {
        console.warn("Falha ao verificar lives automaticamente.", error);
      });
    };

    setTimeout(checkLives, 2_000);
    setInterval(checkLives, env.liveCheckIntervalSeconds * 1000);

    const checkTwitchSubs = () => {
      fetch(`http://localhost:${env.port}/api/twitch-subs/check`, {
        method: "POST",
        headers: { "x-internal-secret": env.internalWebhookSecret }
      }).catch((error) => {
        console.warn("Falha ao sincronizar subs da Twitch automaticamente.", error);
      });
    };

    setTimeout(checkTwitchSubs, 6_000);
    setInterval(checkTwitchSubs, 60 * 60 * 1000);
  }
});
