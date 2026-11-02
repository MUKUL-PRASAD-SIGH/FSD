const mongoose = require('mongoose');

const savedSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    status: { type: String, enum: ['saved', 'applied', 'shortlisted', 'rejected', 'won'], default: 'saved' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);
savedSchema.index({ user: 1, listing: 1 }, { unique: true });

module.exports = mongoose.model('Saved', savedSchema);
