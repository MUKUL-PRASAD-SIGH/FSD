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

test('a real DOCX is parsed into skills, domain and graduation year', async () => {
  const docx = fs.readFileSync(path.join(__dirname, 'fixtures', 'resume.docx'));
  const { parsed } = await parseResume(docx, 'cv.docx');
  for (const s of ['SQL', 'Pandas', 'Data Analysis', 'Python', 'Docker', 'AWS']) assert.ok(parsed.skills.includes(s), s);
  assert.equal(parsed.domains[0].name, 'Data Science');
  assert.equal(parsed.graduationYear, 2026);
  assert.ok(parsed.experienceKeywords.includes('internship'));
});

// Regression: found by the live end-to-end run. Uploaded files arrive as a VIEW into a larger shared network buffer
// (byteOffset > 0). pdf.js misread such views ("bad XRef entry") depending on TCP chunking, so a valid PDF sometimes returned 500.
test('a PDF that is a view into a larger shared buffer still parses; an unreadable PDF is a clean 400', async () => {
  const real = fs.readFileSync(FIXTURE);
  const head = Buffer.from('--boundary\r\nContent-Disposition: form-data; name="resume"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.padEnd(3744, ' '));
  const shared = Buffer.concat([head, real, Buffer.from('\r\n--boundary--\r\n'), Buffer.alloc(40000)]);
  const view = shared.subarray(head.length, head.length + real.length);
  assert.ok(view.byteOffset > 0 && view.buffer.byteLength > view.length, 'the test really exercises a slice of a bigger buffer');
  const { parsed } = await parseResume(view, 'resume.pdf');
  assert.ok(parsed.skills.includes('Python') && parsed.skills.includes('PyTorch'));
  await assert.rejects(parseResume(Buffer.from('%PDF-1.4 this is not a real pdf'), 'broken.pdf'), (e) => e.status === 400 && /could not read that PDF/.test(e.message));
});
