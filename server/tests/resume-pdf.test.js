const test = require('node:test');
const assert = require('node:assert/strict');
const { parseResume } = require('../services/resumeParser');

// Builds a minimal but valid single-page PDF so the real pdf-parse path is exercised without a binary fixture.
function makePdf(text) {
  const stream = `BT /F1 10 Tf 40 720 Td (${text}) Tj ET`;
  const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>', '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>', `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out);
}

test('a real PDF is parsed into skills, domain and graduation year', async () => {
  const pdf = makePdf('B.Tech Computer Science, Sample University, 2027. Skills: Python, PyTorch, NLP, React, Docker. Built an LLM RAG chatbot. Hackathon winner.');
  const { parsed } = await parseResume(pdf, 'cv.pdf');
  for (const s of ['Python', 'PyTorch', 'NLP', 'React', 'Docker', 'LLM']) assert.ok(parsed.skills.includes(s), s);
  assert.equal(parsed.domains[0].name, 'AI/ML');
  assert.equal(parsed.graduationYear, 2027);
});

test('unsupported and empty files are rejected with a helpful error', async () => {
  await assert.rejects(parseResume(Buffer.from('x'), 'cv.exe'), /Unsupported resume format/);
  await assert.rejects(parseResume(Buffer.from('tiny'), 'cv.txt'), /Could not read any text/);
});
