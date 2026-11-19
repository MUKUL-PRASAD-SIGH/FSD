#!/usr/bin/env node
// Fails (exit 1) if a tracked file looks like it contains a real credential. Runs in CI and as `npm run secrets`.
// Placeholders in docs/examples (USER, you@gmail.com, xxxxx, <...>) are allowed. Prints file:line and the rule, never the value.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const RULES = [
  ['MongoDB URI with password', /mongodb(\+srv)?:\/\/[^\s:@/"'`<>]+:([^\s@"'`<>]{6,})@/g, (m) => !/^(USER|user|username|<|password|PASSWORD|pass|xxx)/i.test(m[2]) && !/xxxxx|<|example/.test(m[0])],
  ['SMTP URL with password', /smtps?:\/\/[^\s:@"'`<>]+:([^\s@"'`<>]{6,})@/g, (m) => !/^(<|pass|password|app-password|xxxx|your)/i.test(m[1]) && !/you(%40|@)|user:|example/.test(m[0])],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/g],
  ['Google OAuth client secret', /GOCSPX-[0-9A-Za-z_-]{20,}/g],
  ['Twilio account SID / API key', /\b(AC|SK)[0-9a-f]{32}\b/g, (m) => !/^(AC|SK)(0+|1+|f+)$/i.test(m[0])], // all-zero fakes in tests are fine
  ['Slack token', /xox[abprs]-[0-9A-Za-z-]{10,}/g],
  ['Stripe live key', /sk_live_[0-9A-Za-z]{20,}/g],
  ['OpenAI / Anthropic key', /\b(sk-(proj-|ant-)?[A-Za-z0-9_-]{32,})\b/g],
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/g],
  ['JWT_SECRET assignment', /^[ \t]*JWT_SECRET[ \t]*=[ \t]*([^\s#<]{16,})/gm, (m) => !/change|example|your|xxx|<|\$\{/i.test(m[1])],
  ['Gmail app password', /\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b/g, (m, file) => /\.env|config|\.json$/.test(file)],
];
const SKIP = /(^|\/)(node_modules|dist|\.git)\/|package-lock\.json$|\.(png|jpe?g|gif|webp|ico|pdf|docx|woff2?|ttf|zip)$/i;
// Files that legitimately contain test credentials or pattern examples
const ALLOW = new Set(['scripts/secret-scan.js']);

const files = execFileSync('git', ['ls-files'], { cwd: root }).toString().split('\n').filter((f) => f && !SKIP.test(f) && !ALLOW.has(f));
const hits = [];
for (const file of files) {
  let text;
  try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  if (text.includes('\u0000')) continue;
  for (const [rule, re, keep = () => true] of RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (!keep(m, file)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      hits.push(`${file}:${line}  ${rule}`);
    }
  }
}
// A tracked file named like an env file is always wrong (only *.example is allowed)
for (const f of files) if (/(^|\/)(\.env(\.[\w-]+)?|env)$/.test(f) && !/\.example$/.test(f)) hits.push(`${f}  env file is tracked by git`);

if (hits.length) {
  console.error(`Possible secrets in tracked files (${hits.length}):\n  ${hits.join('\n  ')}\nRemove them, rotate the credential, and keep secrets in .env (git-ignored).`);
  process.exit(1);
}
console.log(`secret scan: ${files.length} tracked files, no credentials found`);
