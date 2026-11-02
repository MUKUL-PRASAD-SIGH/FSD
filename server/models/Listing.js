const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    organiser: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['HACKATHON', 'CASE STUDY', 'CONTEST', 'CODING', 'INNOVATION', 'DESIGN', 'COMPETITION', 'QUIZ'],
      default: 'HACKATHON',
    },
    platform: { type: String, default: 'Direct' },
    source: { type: String, default: 'manual' }, // devpost | seed | manual
    externalId: { type: String },
    url: { type: String, required: true },
    deadline: { type: Date, required: true },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE', 'HYBRID'], default: 'ONLINE' },
    city: { type: String, default: '' },
    prizeLabel: { type: String, default: 'See listing' },
    prizeInr: { type: Number, default: null },
    fee: { type: String, default: 'Free' },
    eligibility: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    registered: { type: Number, default: null },
    refreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

listingSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });
listingSchema.index({ deadline: 1 });
listingSchema.index({ title: 'text', organiser: 'text', tags: 'text', skills: 'text' });

module.exports = mongoose.model('Listing', listingSchema);
