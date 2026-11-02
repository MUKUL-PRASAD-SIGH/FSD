const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    organiser: { type: String, default: '', trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 5000 },
    type: {
      type: String,
      enum: ['HACKATHON', 'CASE STUDY', 'CONTEST', 'CODING', 'INNOVATION', 'DESIGN', 'COMPETITION', 'QUIZ'],
      default: 'HACKATHON',
    },
    platform: { type: String, default: 'Direct' },
    source: { type: String, default: 'manual' }, // devpost | unstop | ... | manual (lister) | seed
    externalId: { type: String },
    url: { type: String, required: true, maxlength: 500 },
    startDate: { type: Date },
    deadline: { type: Date, required: true },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE', 'HYBRID'], default: 'ONLINE' },
    city: { type: String, default: '', maxlength: 80 },
    state: { type: String, default: '', maxlength: 80 },
    venue: { type: String, default: '', maxlength: 200 },
    prizeLabel: { type: String, default: 'See listing', maxlength: 80 },
    prizeInr: { type: Number, default: null, min: 0 },
    fee: { type: String, default: 'Free', maxlength: 40 },
    teamMin: { type: Number, min: 1, max: 20 },
    teamMax: { type: Number, min: 1, max: 20 },
    eligibility: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    contactEmail: { type: String, default: '', maxlength: 254 },
    registered: { type: Number, default: null },
    refreshedAt: { type: Date, default: Date.now },

    // Moderation + ownership (manual listings by approved listers)
    status: { type: String, enum: ['published', 'unpublished'], default: 'published', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // RAG index: one embedding per listing (Mongo is the vector store)
    embedding: { type: [Number], select: false },
    embeddingModel: { type: String, select: false },
  },
  { timestamps: true }
);

listingSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });
listingSchema.index({ status: 1, deadline: 1 });
listingSchema.index({ title: 'text', organiser: 'text', tags: 'text', skills: 'text' });

module.exports = mongoose.model('Listing', listingSchema);
