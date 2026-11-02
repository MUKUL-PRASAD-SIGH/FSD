const path = require('path');
const { extractSkills } = require('./skills');

async function extractText(buffer, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.pdf') {
    const pdf = require('pdf-parse');
    return (await pdf(buffer)).text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (ext === '.txt' || ext === '.md') return buffer.toString('utf8');
  const err = new Error('Unsupported resume format. Upload a PDF, DOCX or TXT file.');
  err.status = 400;
  throw err;
}

// Splits resume text into rough sections by common headings.
function sections(text) {
  const heads = /^(education|experience|work experience|projects?|skills|technical skills|achievements|certifications?)\s*:?\s*$/i;
  const out = {};
  let cur = 'header';
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (heads.test(t)) cur = t.toLowerCase().replace(/\s*:$/, '').replace(/s$/, '');
    else out[cur] = (out[cur] || '') + t + '\n';
  }
  return out;
}

function parseResumeText(text) {
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ');
  const sec = sections(clean);
  const found = extractSkills(clean);

  // Skills named in an explicit skills / project / experience section count more.
  const strongText = [sec.skill, sec['technical skill'], sec.project, sec.experience, sec['work experience']]
    .filter(Boolean)
    .join('\n');
  const strong = new Set(extractSkills(strongText).map((s) => s.name));

  const skills = found
    .map((s) => ({ ...s, weight: s.hits + (strong.has(s.name) ? 3 : 0) }))
    .sort((a, b) => b.weight - a.weight);

  const domainScores = {};
  for (const s of skills) domainScores[s.domain] = (domainScores[s.domain] || 0) + s.weight;
  const total = Object.values(domainScores).reduce((a, b) => a + b, 0) || 1;
  const domains = Object.entries(domainScores)
    .map(([name, v]) => ({ name, score: +(v / total).toFixed(3) }))
    .sort((a, b) => b.score - a.score);

  const education = (
    clean.match(/^.*\b(university|institute|college|iit|nit|iiit|b\.?tech|m\.?tech|bsc|msc|mba|bca|mca)\b.*$/gim) || []
  )
    .map((l) => l.trim().slice(0, 140))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

  const years = (clean.match(/\b(20[12]\d)\b/g) || []).map(Number);
  const thisYear = new Date().getFullYear();
  const grad = years.filter((y) => y >= thisYear - 1 && y <= thisYear + 6);
  const graduationYear = grad.length ? Math.max(...grad) : undefined;

  const experienceKeywords = [];
  const expRe = /\b(intern(ship)?|hackathon|winner|finalist|runner[- ]up|open[- ]source|research|published|capstone|freelance|teaching assistant|ranked)\b/gi;
  for (const m of clean.match(expRe) || []) {
    const k = m.toLowerCase();
    if (!experienceKeywords.includes(k)) experienceKeywords.push(k);
  }

  const links = [
    ...new Set(clean.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com|linkedin\.com\/in|kaggle\.com|leetcode\.com)\/[\w\-./]+/gi) || []),
  ].slice(0, 6);

  return {
    skills: skills.map((s) => s.name),
    skillDetail: skills,
    domains,
    education,
    graduationYear,
    experienceKeywords,
    links,
    wordCount: clean.split(/\s+/).filter(Boolean).length,
  };
}

async function parseResume(buffer, fileName) {
  const text = await extractText(buffer, fileName);
  if (!text || text.trim().length < 40) {
    const err = new Error('Could not read any text from this file. If it is a scanned image, upload a text-based PDF or DOCX.');
    err.status = 422;
    throw err;
  }
  return { text, parsed: parseResumeText(text) };
}

module.exports = { parseResume, parseResumeText };
