const test = require('node:test');
const assert = require('node:assert/strict');
const { parseResume } = require('../services/resumeParser');

// A real PDF rendered by Chromium (tests/fixtures/resume.pdf). A hand-assembled PDF used to live here, but
// pdf.js 1.10 (inside pdf-parse) rejects its xref table, so the test now uses a genuine file.
const fs = require('fs');
const path = require('path');
const FIXTURE = path.join(__dirname, 'fixtures', 'resume.pdf');

test('a real PDF is parsed into skills, domain and graduation year', async () => {
  const pdf = fs.readFileSync(FIXTURE);
  const { parsed } = await parseResume(pdf, 'cv.pdf');
  for (const s of ['Python', 'PyTorch', 'NLP', 'React', 'Docker', 'LLM']) assert.ok(parsed.skills.includes(s), s);
  assert.equal(parsed.domains[0].name, 'AI/ML');
  assert.equal(parsed.graduationYear, 2027);
});

test('unsupported and empty files are rejected with a helpful error', async () => {
  await assert.rejects(parseResume(Buffer.from('x'), 'cv.exe'), /Unsupported resume format/);
  await assert.rejects(parseResume(Buffer.from('tiny'), 'cv.txt'), /Could not read any text/);
});
