const mongoose = require('mongoose');

// One document per adapter per ingest run. Drives the admin "Source coverage" dashboard.
const sourceSyncSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, index: true },
    label: String,
    runId: { type: String, index: true },
    status: { type: String, enum: ['ok', 'partial', 'failed', 'skipped'], required: true },
    error: { type: String, default: '' },
    skippedReason: { type: String, default: '' },
    startedAt: Date,
    finishedAt: Date,
    durationMs: Number,
    raw: { type: Number, default: 0 }, // records the source returned
    valid: { type: Number, default: 0 }, // passed validation and still open
    expired: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 }, // within-feed repeats + cross-source duplicates merged into another record
    rejected: { type: Number, default: 0 },
    stored: { type: Number, default: 0 }, // valid - duplicates: listings this source contributes as primary
    removedStale: { type: Number, default: 0 },
    rejectReasons: { type: Map, of: Number, default: {} },
    rejectSamples: { type: [{ reason: String, title: String, externalId: String, _id: false }], default: [] },
    pages: { fetched: Number, expected: Number, complete: Boolean, capped: Boolean },
  },
  { timestamps: true }
);
sourceSyncSchema.index({ source: 1, createdAt: -1 });
// Keep ~90 days of history
sourceSyncSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });

module.exports = mongoose.model('SourceSync', sourceSyncSchema);
