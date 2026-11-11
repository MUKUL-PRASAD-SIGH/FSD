const mongoose = require('mongoose');

// Remembers which email reminders were already sent, so the scheduler is idempotent and never double-sends.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  minutes: { type: Number, required: true },
  sentAt: { type: Date, default: Date.now },
});
schema.index({ user: 1, listing: 1, minutes: 1 }, { unique: true });
schema.index({ sentAt: 1 }, { expireAfterSeconds: 60 * 86400 });

module.exports = mongoose.model('ReminderLog', schema);
