const mongoose = require('mongoose');

// A user's OWN conversation with an event's agent. Private to that user: only ever read with { user: req.user._id },
// deletable by them at any time, removed with their account, and auto-expired after 180 days.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    question: { type: String, required: true, maxlength: 400 },
    answer: { type: String, maxlength: 1500, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
schema.index({ user: 1, listing: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });

module.exports = mongoose.model('UserQuery', schema);
