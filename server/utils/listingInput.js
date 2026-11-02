// Validation for the lister "new listing" template. Returns { errors: {field: msg}, data }.
const { str, isUrl, isEmail } = require('./sanitize');
const { extractSkills } = require('../services/skills');

const TYPES = ['HACKATHON', 'CASE STUDY', 'CONTEST', 'CODING', 'INNOVATION', 'DESIGN', 'COMPETITION', 'QUIZ'];
const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'];
const ELIGIBILITY = ['School students', 'Undergraduate', 'Postgraduate', 'Engineering Students', 'Management', 'PhD / researchers', 'Working professionals', 'Open to all'];
const list = (v, max, len = 60) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((s) => str(String(s), len)).filter(Boolean))].slice(0, max);

function validateListing(b, { partial = false } = {}) {
  const errors = {};
  const d = {};
  const need = (k, cond, msg) => { if (!partial || b[k] !== undefined) if (!cond) errors[k] = msg; };

  d.title = str(b.title, 200);
  need('title', d.title.length >= 5, 'Title must be at least 5 characters');
  d.organiser = str(b.organiser, 160);
  need('organiser', d.organiser.length >= 2, 'Organiser is required');
  d.description = str(b.description, 5000);
  need('description', d.description.length >= 30, 'Describe the event in at least 30 characters');
  d.type = TYPES.includes(b.type) ? b.type : undefined;
  need('type', !!d.type, `Type must be one of ${TYPES.join(', ')}`);
  d.mode = MODES.includes(b.mode) ? b.mode : undefined;
  need('mode', !!d.mode, 'Mode must be ONLINE, OFFLINE or HYBRID');
  d.url = str(b.url, 500);
  need('url', isUrl(d.url), 'Registration link must be a valid http(s) URL');
  d.deadline = b.deadline ? new Date(b.deadline) : undefined;
  need('deadline', d.deadline instanceof Date && !isNaN(d.deadline) && d.deadline > new Date(), 'Registration deadline must be a future date');
  if (b.startDate) {
    d.startDate = new Date(b.startDate);
    if (isNaN(d.startDate)) errors.startDate = 'Start date is invalid';
    else if (d.deadline && d.startDate < new Date(d.deadline.getTime() - 90 * 86400000)) errors.startDate = 'Start date looks too early compared to the deadline';
  }
  if (d.mode && d.mode !== 'ONLINE') {
    d.city = str(b.city, 80);
    need('city', d.city.length >= 2, 'City is required for in-person and hybrid events');
    d.state = str(b.state, 80); d.venue = str(b.venue, 200);
  } else { d.city = ''; d.state = ''; d.venue = ''; }

  const prize = b.prizeInr === '' || b.prizeInr == null ? null : Number(b.prizeInr);
  if (prize != null && (!(prize >= 0) || prize > 1e9)) errors.prizeInr = 'Prize must be a non-negative number';
  d.prizeInr = prize;
  d.prizeLabel = prize ? `₹${prize.toLocaleString('en-IN')}` : str(b.prizeLabel, 80) || 'See listing';
  d.fee = Number(b.feeInr) > 0 ? `₹${Number(b.feeInr)}` : 'Free';
  const tmin = b.teamMin ? Number(b.teamMin) : undefined, tmax = b.teamMax ? Number(b.teamMax) : undefined;
  if ((tmin && (tmin < 1 || tmin > 20)) || (tmax && (tmax < 1 || tmax > 20)) || (tmin && tmax && tmin > tmax)) errors.teamMin = 'Team size must be between 1 and 20, min ≤ max';
  d.teamMin = tmin; d.teamMax = tmax;
  d.eligibility = list(b.eligibility, 6, 40).filter((e) => ELIGIBILITY.includes(e));
  d.tags = list(b.tags, 10);
  const given = list(b.skills, 12);
  d.skills = [...new Set([...given, ...extractSkills(`${d.title} ${d.tags.join(' ')} ${d.description}`).map((s) => s.name)])].slice(0, 12);
  d.contactEmail = str(b.contactEmail, 254).toLowerCase();
  if (d.contactEmail && !isEmail(d.contactEmail)) errors.contactEmail = 'Contact email is invalid';

  if (partial) for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  return { errors, data: d };
}

module.exports = { validateListing, TYPES, MODES, ELIGIBILITY };
