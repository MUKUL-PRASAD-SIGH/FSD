const mongoose = require('mongoose');

// Colleges shown in the profile / onboarding dropdown. Seeded from data/colleges-*.js; users add the ones that are missing.
// A user-added college is visible to the next person straight away (that is the point), and is also queued for an admin
// to review (approve, rename, merge into an existing one, or hide).
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    key: { type: String, required: true, unique: true }, // normalised name for matching, see services/colleges.js
    aliases: { type: [String], default: [] },
    aliasKeys: { type: [String], default: [], index: true },
    city: { type: String, default: '', maxlength: 80 },
    source: { type: String, enum: ['seed', 'user'], default: 'seed' },
    reviewed: { type: Boolean, default: true },
    hidden: { type: Boolean, default: false },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    users: { type: Number, default: 0, min: 0 }, // how many profiles use it (ranking in the dropdown)
  },
  { timestamps: true }
);
schema.index({ hidden: 1, users: -1 });
schema.index({ source: 1, reviewed: 1, createdAt: -1 });

module.exports = mongoose.model('College', schema);
