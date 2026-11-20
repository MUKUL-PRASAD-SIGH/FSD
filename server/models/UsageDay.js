const mongoose = require('mongoose');

// Time on platform, one row per signed-in user per day (UTC). Filled by the client heartbeat (POST /api/track/heartbeat),
// which only counts time while the tab is visible. Users who turned off privacy.shareUsage are never recorded.
// Admin-only to read; deleted with the account; auto-expires after 365 days.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    date: { type: Date, required: true }, // midnight UTC of `day`, for range queries and the TTL
    seconds: { type: Number, default: 0, min: 0 },
    heartbeats: { type: Number, default: 0, min: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);
schema.index({ user: 1, day: 1 }, { unique: true });
schema.index({ date: -1 });
schema.index({ date: 1 }, { expireAfterSeconds: 365 * 86400 });

module.exports = mongoose.model('UsageDay', schema);
