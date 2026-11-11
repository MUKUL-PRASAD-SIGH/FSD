// What the API is allowed to reveal about a user. Never includes password hashes, reset tokens or resume text.
const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  avatar: u.avatar,
  role: u.role,
  emailVerified: u.emailVerified,
  hasPassword: !!u.hasPassword,
  googleLinked: !!u.googleId,
  plan: { tier: u.plan?.tier || 'free', since: u.plan?.since },
  lister: u.role === 'lister' || u.lister?.approvalStatus
    ? {
        organisation: u.lister?.organisation,
        website: u.lister?.website,
        approvalStatus: u.lister?.approvalStatus,
        reviewNote: u.lister?.reviewNote,
      }
    : null,
  college: u.college,
  bio: u.bio,
  githubUrl: u.githubUrl,
  linkedinUrl: u.linkedinUrl,
  location: u.location,
  education: u.education,
  skills: u.skills,
  interests: u.interests,
  preferences: u.preferences,
  privacy: { shareQuestions: u.privacy?.shareQuestions !== false },
  social: { discoverable: !!u.social?.discoverable, headline: u.social?.headline || '', lookingForTeam: !!u.social?.lookingForTeam },
  notify: { inApp: u.notify?.inApp, email: u.notify?.email, minMatch: u.notify?.minMatch, emailReminders: !!u.notify?.emailReminders, emailSocial: u.notify?.emailSocial !== false },
  resume: u.resume?.parsedAt
    ? {
        fileName: u.resume.fileName,
        parsedAt: u.resume.parsedAt,
        skills: u.resume.skills,
        domains: u.resume.domains,
        education: u.resume.education,
        graduationYear: u.resume.graduationYear,
        experienceKeywords: u.resume.experienceKeywords,
        links: u.resume.links,
        indexed: u.resume.embeddingModel || null,
      }
    : null,
  createdAt: u.createdAt,
});

module.exports = { publicUser };
