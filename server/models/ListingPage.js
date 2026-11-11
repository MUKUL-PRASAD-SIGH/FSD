const mongoose = require('mongoose');

// Cached crawl of one event's own site (the event page plus a few official info pages), so repeat questions don't re-crawl
// the organiser's website. Documents expire automatically (TTL index): 6 h on success, 10 min on failure.
const schema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    url: String,
    ok: Boolean,
    error: String,
    title: String,
    jsOnly: Boolean, // page had almost no readable text (content rendered by JavaScript)
    pages: { type: [{ url: String, title: String, ok: Boolean, note: String, _id: false }], default: [] },
    passages: { type: [{ heading: String, text: String, url: String, _id: false }], default: [] },
    faq: { type: [{ question: String, answer: String, url: String, _id: false }], default: [] },
    fetchedAt: Date,
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: false }
);

module.exports = mongoose.model('ListingPage', schema);
