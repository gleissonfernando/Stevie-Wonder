import { Router } from "express";
import { requireAuth } from "../auth";
import { env } from "../env";
import { connectMongo } from "../services/mongo";
import { assertCanManageLives } from "../services/discordGuild";
import { DashboardActionLog, DashboardConfig } from "../models/dashboardRealtime";

export const dashboardRealtimeRoutes = Router();

async function handleConfigRequest(request: any, response: any, next: any) {
  try {
    const guildId = typeof request.params.guildId === "string" ? request.params.guildId : env.guildId;
    await assertCanManageLives(request.user!.id, guildId);
    await connectMongo();

    const config = await DashboardConfig.findOne({ guildId }).lean();
    const logs = await DashboardActionLog.find({ guildId }).sort({ createdAt: -1 }).limit(30).lean();

    response.json({ config, logs });
  } catch (error) {
    next(error);
  }
}

dashboardRealtimeRoutes.get("/config", requireAuth, handleConfigRequest);
dashboardRealtimeRoutes.get("/config/:guildId", requireAuth, handleConfigRequest);
