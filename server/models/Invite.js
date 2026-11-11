const mongoose = require('mongoose');

// One model for every "someone asks you to join something" flow, so accept/decline/expiry logic lives in one place:
//   team_invite   owner -> person        (they join the team and its private room)
//   team_request  person -> owner        (Pro: ask to join a public team)
//   room_invite   room owner -> person   (they join a private group room)
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['team_invite', 'team_request', 'room_invite'], required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    target: { type: String, required: true }, // team or room id as a string: lets one index forbid duplicate pending invites
    message: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
schema.index({ kind: 1, from: 1, to: 1, target: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
schema.index({ to: 1, status: 1, createdAt: -1 });
schema.index({ from: 1, status: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // pending invites vanish after 14 days; resolved ones after 30

module.exports = mongoose.model('Invite', schema);
