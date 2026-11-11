const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['new_match', 'deadline', 'lister_request', 'lister_decision', 'system', 'connection_request', 'connection_accepted', 'team_invite', 'team_request', 'team_joined', 'room_invite'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 500 },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    link: { type: String, default: '' },
    score: Number,
    readAt: Date,
    emailedAt: Date,
  },
  { timestamps: true }
);
// One notification per (user, listing, type): reruns never duplicate
notificationSchema.index({ user: 1, listing: 1, type: 1 }, { unique: true, partialFilterExpression: { listing: { $exists: true } } });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
