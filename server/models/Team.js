const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }, // the hackathon this team is for (optional)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: {
      type: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['owner', 'member'], default: 'member' }, joinedAt: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    maxMembers: { type: Number, default: 4, min: 2, max: 10 },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' }, // public = open to join requests (Pro)
    lookingFor: { type: [String], default: [] }, // skills the team wants, used by the Pro matcher
    description: { type: String, default: '', maxlength: 300 },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  },
  { timestamps: true }
);
schema.index({ 'members.user': 1 });
schema.index({ visibility: 1, listing: 1 });

module.exports = mongoose.model('Team', schema);
