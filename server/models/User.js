const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    college: { type: String, default: '' },
    bio: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    // Profile fields that drive recommendations. User-editable.
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] }, // domains/tags, e.g. "AI/ML"
    preferences: {
      modes: { type: [String], default: [] }, // ONLINE | OFFLINE | HYBRID
      cities: { type: [String], default: [] },
      types: { type: [String], default: [] }, // HACKATHON | CASE STUDY | CONTEST ...
      freeOnly: { type: Boolean, default: false },
      minPrizeInr: { type: Number, default: 0 },
    },
    // Output of the resume parser (kept separate so edits don't erase it)
    resume: {
      fileName: String,
      parsedAt: Date,
      text: { type: String, select: false },
      skills: [String],
      domains: [{ name: String, score: Number, _id: false }],
      education: [String],
      graduationYear: Number,
      experienceKeywords: [String],
      links: [String],
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
