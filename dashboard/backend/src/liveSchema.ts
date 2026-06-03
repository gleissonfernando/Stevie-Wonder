import { z } from "zod";

export const liveRequestSchema = z.object({
  liveName: z.string().trim().min(3).max(80),
  platform: z.enum(["TWITCH", "YOUTUBE", "KICK"]),
  liveUrl: z.string().trim().url().max(300),
  startTime: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(1000)
});
