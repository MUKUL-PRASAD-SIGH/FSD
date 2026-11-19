const mongoose = require('mongoose');

// Product analytics events. Admin-only to read (services/analytics.js); the user-facing AI never touches this model.
// What is stored is deliberately small: the event type, the app path (no query string), the listing involved, and for
// searches the search text (clipped). `user` is empty for signed-out visitors and for users who turned off
// privacy.shareUsage, so those events still count in totals but are never tied to a person.
// Deleted with the account; auto-expires after 180 days.
const TYPES = ['page_view', 'listing_view', 'register_click', 'search'];

const schema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    path: { type: String, maxlength: 120, default: '' },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    query: { type: String, maxlength: 80, default: '' },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);
schema.index({ type: 1, at: -1 });
schema.index({ listing: 1, type: 1, at: -1 });
schema.index({ user: 1, at: -1 });
schema.index({ at: 1 }, { expireAfterSeconds: 180 * 86400 });

module.exports = mongoose.model('Activity', schema);
module.exports.TYPES = TYPES;
