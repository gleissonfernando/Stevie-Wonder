const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    coins: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userProfileSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.models.UserProfile || mongoose.model("UserProfile", userProfileSchema);
