const mongoose = require('mongoose');

// Plain text only (rendered escaped by the client). 2000 characters max.
const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', schema);
