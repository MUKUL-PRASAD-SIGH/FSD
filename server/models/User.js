const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // Optional because Google-only accounts have no password
    password: { type: String, select: false },
    hasPassword: { type: Boolean, default: false },
    googleId: { type: String, index: { unique: true, sparse: true } },
    avatar: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },

    role: { type: String, enum: ['user', 'lister', 'admin'], default: 'user', index: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    plan: {
      tier: { type: String, enum: ['free', 'pro'], default: 'free' },
      since: Date,
      via: { type: String, enum: ['key', 'admin', null], default: null },
    },

    // Lister onboarding (role === 'lister'). Listing is blocked until approvalStatus === 'approved'.
    lister: {
      organisation: { type: String, trim: true, maxlength: 120 },
      website: { type: String, trim: true, maxlength: 300 },
      reason: { type: String, trim: true, maxlength: 600 },
      approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      reviewNote: { type: String, maxlength: 400 },
    },

    // Brute-force protection and session revocation
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
    tokenVersion: { type: Number, default: 0 },
    passwordChangedAt: Date,
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    // Profile used for recommendations
    college: { type: String, default: '', maxlength: 160 },
    bio: { type: String, default: '', maxlength: 600 },
    githubUrl: { type: String, default: '', maxlength: 300 },
    linkedinUrl: { type: String, default: '', maxlength: 300 },
    location: { city: { type: String, default: '', maxlength: 80 }, state: { type: String, default: '', maxlength: 80 }, country: { type: String, default: 'India', maxlength: 80 } },
    education: { level: { type: String, enum: ['', 'school', 'undergraduate', 'postgraduate', 'phd', 'working'], default: '' }, gradYear: Number },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    preferences: {
      modes: { type: [String], default: [] },
      cities: { type: [String], default: [] },
      types: { type: [String], default: [] },
      freeOnly: { type: Boolean, default: false },
      minPrizeInr: { type: Number, default: 0 },
      maxTravelKm: { type: Number, default: 0 }, // 0 = online/local only, otherwise "willing to travel anywhere in country" flag below
      willingToTravel: { type: Boolean, default: false },
    },
    notify: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      minMatch: { type: Number, default: 55, min: 0, max: 100 },
      lastRunAt: { type: Date, default: Date.now },
    },
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
      // RAG: resume split into overlapping chunks, each with an embedding (Pro only)
      chunks: { type: [{ text: String, embedding: [Number], _id: false }], select: false },
      embeddingModel: String,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
  this.hasPassword = true;
  if (!this.isNew) { this.passwordChangedAt = new Date(); this.tokenVersion += 1; }
});

userSchema.methods.comparePassword = function (plain) {
  return this.password ? bcrypt.compare(plain, this.password) : Promise.resolve(false);
};
userSchema.methods.isLocked = function () { return !!(this.lockUntil && this.lockUntil > new Date()); };
userSchema.methods.isPro = function () { return this.plan?.tier === 'pro' || this.role === 'admin'; };

module.exports = mongoose.model('User', userSchema);
module.exports.BCRYPT_COST = BCRYPT_COST;
