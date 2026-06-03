const mongoose = require("mongoose");

const dashboardConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    logChannelId: { type: String },
    welcomeMessage: { type: String },
    autoRoleId: { type: String },
    systems: { type: Map, of: Boolean, default: {} },
    panels: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

dashboardConfigSchema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.models.DashboardConfig || mongoose.model("DashboardConfig", dashboardConfigSchema);
