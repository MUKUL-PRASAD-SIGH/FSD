const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Opportunity title is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company or organizer name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    type: {
      type: String,
      enum: ['Hackathon', 'Internship', 'Full-time', 'Coding Contest', 'Research Grant'],
      required: [true, 'Type is required'],
      default: 'Hackathon',
    },
    domain: {
      type: String,
      enum: [
        'AI/ML',
        'Web Development',
        'Cloud & DevOps',
        'Cybersecurity',
        'Blockchain & Web3',
        'Mobile Development',
        'Data Science',
      ],
      required: [true, 'Domain is required'],
      default: 'AI/ML',
    },
    locationType: {
      type: String,
      enum: ['Remote', 'Hybrid', 'On-site'],
      default: 'Remote',
    },
    locationName: {
      type: String,
      default: 'Global',
    },
    reward: {
      type: String,
      default: 'Prizes & Certificates',
    },
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    startDate: {
      type: Date,
    },
    eligibility: {
      type: String,
      default: 'Open to all college students & recent grads',
    },
    skillsRequired: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    bannerImage: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Closed', 'Upcoming'],
      default: 'Active',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    applicantCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching & filtering
opportunitySchema.index({ title: 'text', description: 'text', company: 'text', skillsRequired: 'text' });
opportunitySchema.index({ domain: 1, type: 1, locationType: 1, status: 1 });

module.exports = mongoose.model('Opportunity', opportunitySchema);
