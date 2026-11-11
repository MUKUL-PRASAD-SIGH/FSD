const mongoose = require('mongoose');

// A private conversation. Membership is the ONLY access rule: only listed members can read, send or join the live channel.
//   dm     exactly two connected users (dmKey is unique per pair)
//   team   the team's private room (membership mirrors the team)
//   group  invite-only room made by a user
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['dm', 'team', 'group'], required: true },
    name: { type: String, default: '', maxlength: 80 },
    members: {
      type: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['owner', 'member'], default: 'member' }, joinedAt: { type: Date, default: Date.now }, lastReadAt: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    dmKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: '', maxlength: 140 },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
schema.index({ 'members.user': 1, lastMessageAt: -1 });
schema.index({ dmKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Room', schema);
