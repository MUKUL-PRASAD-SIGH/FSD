const mongoose = require('mongoose');

// "Something is wrong with this listing" reports from users. Reviewed in Admin → review; the reporter's identity is only
// shown to admins.
const REASONS = ['wrong_dates', 'wrong_prize', 'wrong_location', 'broken_link', 'duplicate', 'spam_or_fake', 'closed', 'other'];

const schema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REASONS, required: true },
    note: { type: String, maxlength: 500, default: '' },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);
schema.index({ listing: 1, user: 1, status: 1 });

module.exports = mongoose.model('ListingReport', schema);
module.exports.REASONS = REASONS;
