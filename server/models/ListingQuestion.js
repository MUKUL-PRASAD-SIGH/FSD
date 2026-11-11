const mongoose = require('mongoose');

// Anonymous, aggregated "what people ask about this event". Deliberately holds NO user reference, session or IP:
// a document is just (listing, normalised question key, scrubbed text, how many times it was asked).
// Only users who have not opted out contribute, and questions containing anything personal are never stored here.
const schema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    key: { type: String, required: true }, // order-independent hash of the question's meaningful words
    text: { type: String, required: true, maxlength: 160 },
    count: { type: Number, default: 1 },
    firstAskedAt: { type: Date, default: Date.now },
    lastAskedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
schema.index({ listing: 1, key: 1 }, { unique: true });
schema.index({ listing: 1, count: -1 });
schema.index({ lastAskedAt: 1 }, { expireAfterSeconds: 365 * 86400 }); // aggregates are not kept forever

module.exports = mongoose.model('ListingQuestion', schema);
