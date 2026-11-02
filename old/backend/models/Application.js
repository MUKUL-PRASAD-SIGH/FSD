const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Applied', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected'],
      default: 'Applied',
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    coverNote: {
      type: String,
      default: '',
    },
    portfolioLinks: {
      type: [String],
      default: [],
    },
    feedback: {
      type: String,
      default: '',
    },
    timeline: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications by the same student for the same opportunity
applicationSchema.index({ opportunityId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
