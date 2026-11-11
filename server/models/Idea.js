const mongoose = require('mongoose');

// Team idea board (Pro). Each member has two ranked votes per team: rank 1 = 10 points, rank 2 = 5 points.
const schema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    votes: { type: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, rank: { type: Number, enum: [1, 2] }, points: { type: Number }, _id: false }], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Idea', schema);
