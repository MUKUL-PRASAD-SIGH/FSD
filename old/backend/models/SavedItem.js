const mongoose = require('mongoose');

const savedItemSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

savedItemSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });

module.exports = mongoose.model('SavedItem', savedItemSchema);
