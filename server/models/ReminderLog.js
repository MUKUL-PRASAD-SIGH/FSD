const mongoose = require('mongoose');

// Remembers which reminders were already sent, per channel, so the scheduler is idempotent and never double-sends.
// (Older rows have no channel and count as 'email'.)
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  minutes: { type: Number, required: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
  sentAt: { type: Date, default: Date.now },
});
schema.index({ user: 1, listing: 1, minutes: 1, channel: 1 }, { unique: true, name: 'user_listing_minutes_channel' });
schema.index({ user: 1, channel: 1, sentAt: -1 });
schema.index({ sentAt: 1 }, { expireAfterSeconds: 60 * 86400 });

module.exports = mongoose.model('ReminderLog', schema);
