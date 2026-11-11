const mongoose = require('mongoose');

// A relationship between two users. One document per pair (pair = the two ids sorted and joined), so a request can never be
// duplicated in either direction. status 'blocked' means blockedBy has blocked the other person: no requests, DMs or invites.
const schema = new mongoose.Schema(
  {
    pair: { type: String, required: true, unique: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'blocked'], default: 'pending' },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date,
  },
  { timestamps: true }
);
schema.index({ requester: 1, status: 1 });
schema.index({ recipient: 1, status: 1 });

schema.statics.pairKey = (a, b) => [String(a), String(b)].sort().join('_');

module.exports = mongoose.model('Connection', schema);
