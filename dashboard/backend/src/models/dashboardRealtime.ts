import mongoose, { Schema } from "mongoose";

const dashboardConfigSchema = new Schema(
  {
    guildId: { type: String, required: true },
    logChannelId: { type: String },
    welcomeMessage: { type: String },
    autoRoleId: { type: String },
    systems: { type: Map, of: Boolean, default: {} },
    panels: { type: Map, of: Schema.Types.Mixed, default: {} },
    settings: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

dashboardConfigSchema.index({ guildId: 1 }, { unique: true });

const dashboardActionLogSchema = new Schema(
  {
    actionId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String },
    action: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["queued", "success", "error"], default: "queued", index: true },
    message: { type: String },
    executedAt: { type: Date }
  },
  { timestamps: true }
);

export const DashboardConfig =
  mongoose.models.DashboardConfig || mongoose.model("DashboardConfig", dashboardConfigSchema);

export const DashboardActionLog =
  mongoose.models.DashboardActionLog || mongoose.model("DashboardActionLog", dashboardActionLogSchema);
