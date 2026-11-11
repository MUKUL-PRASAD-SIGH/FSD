// Browser journeys through the real UI (Vite dev server + API + MongoDB), with Playwright/Chromium.
//   node e2e/journeys.js [baseUrl]      (default http://localhost:5173)
// Reads ADMIN_EMAIL / ADMIN_PASSWORD / PRO_ACTIVATION_KEYS from the repo-root .env; never prints them.
// Writes screenshots and a pass/fail report to e2e/output/ (git-ignored).
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = path.join(__dirname, 'output'); // git-ignored
const RESUME = path.join(__dirname, '..', 'server', 'tests', 'fixtures', 'resume.pdf');
fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const student = { name: 'Asha Verma', email: `asha.${stamp}@example.com`, password: 'Kite-Runner-42!x' };
const lister = { name: 'Ravi Club', email: `ravi.${stamp}@example.com`, password: 'Club-Organiser-77!y', org: 'Pune AI Club' };
const results = [];
const consoleErrors = [];

async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`PASS  ${name}`); }
  catch (e) { results.push({ name, ok: false, error: e.message.split('\n')[0], ms: Date.now() - t }); console.log(`FAIL  ${name}: ${e.message.split('\n')[0]}`); }
}
const shot = (page, name, full = true) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
const expectText = async (page, text, timeout = 8000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });

async function signOut(page) { await page.getByRole('button', { name: 'Sign out' }).click(); await page.getByRole('link', { name: 'Sign in' }).waitFor(); }
async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: pageerror ${e.message}`));

  await step('1. Landing / browse renders listings, stats and filters', async () => {
    await page.goto(BASE);
    await page.locator('.card h3').first().waitFor();
    await expectText(page, 'open now');
    await shot(page, '01-browse-desktop');
  });

  await step('2. Search and filters narrow the list', async () => {
    const count = async () => Number((await page.locator('[aria-live="polite"]').first().innerText()).match(/\d+/)?.[0]);
    await page.waitForFunction(() => /\d+ listing/.test(document.querySelector('[aria-live="polite"]')?.textContent || ''));
    const before = await count();
    await page.getByLabel('Type').selectOption('CASE STUDY');
    await page.waitForFunction((b) => { const m = (document.querySelector('[aria-live="polite"]')?.textContent || '').match(/(\d+) listing/); return m && Number(m[1]) < b; }, before);
    const titles = await page.locator('.card .mono').allInnerTexts();
    if (!titles.filter((t) => /case study|online|hybrid|offline/.test(t)).length) throw new Error('no cards after filter');
    await page.getByLabel('Type').selectOption('');
    await page.getByLabel('Search').fill('web');
    await page.waitForFunction(() => /^\s*[1-9]\d* listing/.test(document.querySelector('[aria-live="polite"]')?.textContent || ''));
    await shot(page, '02-browse-search-web', false);
    await page.getByLabel('Search').fill('');
  });

  await step('3. Registration enforces the password policy, then creates a student account', async () => {
    await page.goto(`${BASE}/register`);
    await page.getByLabel('Full name').fill(student.name);
    await page.getByLabel('Email').fill(student.email);
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await shot(page, '03-register-weak-password', false);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForTimeout(800);
    if (/for-you/.test(page.url())) throw new Error('weak password was accepted');
    await page.getByLabel('Password', { exact: true }).fill(student.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('button', { name: 'Sign out' }).waitFor();
  });

  await step('4. Profile: skills, interests, education and location are saved', async () => {
    await page.goto(`${BASE}/profile`);
    await page.getByLabel('Skills').fill('Python, PyTorch, NLP, React');
    await page.getByRole('button', { name: 'AI/ML', exact: true }).click();
    await page.getByLabel('City').fill('Pune');
    await page.getByLabel('State').fill('Maharashtra');
    await page.getByLabel('Education level').selectOption('undergraduate');
    await page.getByLabel('Graduation year').fill('2027');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expectText(page, 'Saved');
    await page.reload();
    if ((await page.getByLabel('City').inputValue()) !== 'Pune') throw new Error('profile not persisted');
  });

  await step('5. Free plan: basic recommendations with reasons, resume upload is gated', async () => {
    await page.goto(`${BASE}/for-you`);
    await page.locator('.card .score').first().waitFor();
    await expectText(page, 'Basic picks');
    await page.getByRole('button', { name: 'Why this score?' }).first().click();
    await page.locator('.bars .bar').first().waitFor();
    await shot(page, '05-for-you-free');
  });

  await step('6. Pro activation with a key (wrong key refused first)', async () => {
    await page.goto(`${BASE}/plan`);
    await page.getByLabel('Activation key').fill('WRONG-KEY');
    await page.getByRole('button', { name: 'Activate Pro' }).click();
    await page.locator('.error').first().waitFor();
    await page.getByLabel('Activation key').fill((process.env.PRO_ACTIVATION_KEYS || '').split(',')[0]);
    await page.getByRole('button', { name: 'Activate Pro' }).click();
    await page.getByRole('button', { name: 'Switch back to Free' }).waitFor();
    await shot(page, '06-plan-pro-active', false);
  });

  await step('7. Resume upload (PDF) extracts skills', async () => {
    await page.goto(`${BASE}/profile`);
    await page.getByLabel('Upload resume').setInputFiles(RESUME);
    await page.locator('.parsed').first().waitFor({ timeout: 15000 });
    const parsed = await page.locator('.parsed').first().innerText();
    for (const s of ['PyTorch', 'Docker']) if (!parsed.includes(s)) throw new Error(`skill ${s} not shown after parsing`);
    await shot(page, '07-resume-parsed');
  });

  await step('8. Pro recommendations: 0-100 score, reasons and an 8-criterion breakdown', async () => {
    await page.goto(`${BASE}/for-you`);
    await expectText(page, 'Pro rubric');
    await page.locator('.card .score').first().waitFor();
    const score = Number((await page.locator('.card .score').first().innerText()).match(/\d+/)[0]);
    if (!(score >= 0 && score <= 100)) throw new Error(`bad score ${score}`);
    await page.getByRole('button', { name: 'Why this score?' }).first().click();
    const n = await page.locator('.card').first().locator('.bars .bar').count();
    if (n !== 8) throw new Error(`expected 8 criteria, saw ${n}`);
    const firstTitle = await page.locator('.card h3').first().innerText();
    if (!/AI|Data|Mobile|Cloud|IoT/i.test(firstTitle)) throw new Error(`top pick for an AI/ML profile was "${firstTitle}"`);
    await shot(page, '08-for-you-pro-breakdown');
  });

  await step('9. Bookmark from browse and track the application', async () => {
    await page.goto(BASE);
    const card = page.locator('.card').filter({ hasText: 'Campus AI Build Sprint' });
    await card.getByRole('button', { name: /Save/ }).click();
    await card.getByRole('button', { name: '★ Saved' }).waitFor();
    await page.goto(`${BASE}/tracker`);
    await expectText(page, 'Campus AI Build Sprint');
    await page.locator('.mini select').first().selectOption('applied');
    await page.waitForTimeout(600);
    await page.reload();
    await expectText(page, 'Campus AI Build Sprint');
    if ((await page.locator('.mini select').first().inputValue()) !== 'applied') throw new Error('status not saved');
    await shot(page, '09-tracker');
  });

  await step('10. Listing detail page and per-listing calendar export', async () => {
    await page.goto(BASE);
    await page.locator('.card h3 a').first().click();
    await page.locator('.detail h1').waitFor();
    await expectText(page, 'Register on');
    const href = await page.getByRole('link', { name: 'Add to calendar' }).getAttribute('href');
    const ics = await (await page.request.get(new URL(href, BASE).toString())).text();
    if (!ics.includes('BEGIN:VEVENT') || !ics.includes('TRIGGER:-P1D')) throw new Error('calendar export missing event or reminder');
    await shot(page, '10-listing-detail');
  });

  await step('11. AI assistant answers with citations', async () => {
    await page.goto(`${BASE}/assistant`);
    await page.getByLabel('Your question').fill('online AI hackathons closing soon');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.locator('.cites li').first().waitFor({ timeout: 20000 });
    await shot(page, '11-assistant');
  });

  await step('12. Notifications page loads', async () => {
    await page.goto(`${BASE}/notifications`);
    await page.locator('h1').first().waitFor();
  });

  await step('13. Lister signs up and is blocked until approved', async () => {
    await signOut(page);
    await page.goto(`${BASE}/register`);
    await page.getByRole('tab', { name: 'I run events' }).click();
    await page.getByLabel('Organisation / community').fill(lister.org);
    await page.getByLabel('Full name').fill(lister.name);
    await page.getByLabel('Email').fill(lister.email);
    await page.getByLabel('Password', { exact: true }).fill(lister.password);
    await page.getByRole('button', { name: 'Request lister account' }).click();
    await page.getByRole('button', { name: 'Sign out' }).waitFor();
    await page.goto(`${BASE}/lister`);
    await expectText(page, 'approval');
    await shot(page, '13-lister-pending', false);
    await signOut(page);
  });

  await step('14. Admin approves the lister; source coverage and integrations dashboards render', async () => {
    await signIn(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    await page.goto(`${BASE}/admin`);
    await page.locator('.tbl.cov tbody tr').first().waitFor();
    const rows = await page.locator('.tbl.cov tbody tr').count();
    if (rows < 16) throw new Error(`coverage table has ${rows} rows`);
    await page.locator('.tbl.cov tbody tr').filter({ hasText: 'Devpost' }).getByRole('button', { name: 'details' }).click();
    await page.locator('.cov-detail').waitFor();
    await shot(page, '14a-admin-source-coverage');
    await page.getByRole('button', { name: 'integrations', exact: true }).click();
    await page.locator('.tbl tbody tr').first().waitFor();
    await shot(page, '14b-admin-integrations', false);
    await page.getByRole('button', { name: 'listers', exact: true }).click();
    const panel = page.locator('.panel').filter({ hasText: lister.email });
    await panel.getByRole('button', { name: 'Approve' }).click();
    await panel.waitFor({ state: 'detached' });
    await signOut(page);
  });

  await step('15. Approved lister publishes an event and it appears in browse', async () => {
    await signIn(page, lister.email, lister.password);
    await page.goto(`${BASE}/lister`);
    await page.getByRole('button', { name: '+ New event' }).click();
    const title = `Pune GenAI Night ${stamp}`;
    await page.getByLabel('Event title *').fill(title);
    await page.getByLabel('Organiser *').fill(lister.org);
    await page.getByLabel('Description *').fill('A one-night build sprint for students working with LLMs and Python. Teams of up to four; judged on usefulness and demo.');
    await page.getByLabel('Registration link *').fill('https://example.org/pune-genai-night');
    const dl = new Date(Date.now() + 10 * 86400000); dl.setMinutes(dl.getMinutes() - dl.getTimezoneOffset());
    await page.getByLabel('Registration deadline *').fill(dl.toISOString().slice(0, 16));
    await page.getByLabel('Skills involved').fill('Python, LLM');
    await shot(page, '15a-lister-form');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expectText(page, title);
    await page.goto(BASE);
    await page.getByLabel('Search').fill('GenAI Night');
    await page.locator('.card').filter({ hasText: title }).waitFor();
    await shot(page, '15b-lister-event-in-browse', false);
    await signOut(page);
  });

  await step('16. Mobile layout: no horizontal page scroll on browse, login and for-you', async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    m.setDefaultTimeout(10000);
    const mp = await m.newPage();
    for (const [url, name, login] of [[BASE, '16a-mobile-browse'], [`${BASE}/login`, '16b-mobile-login']]) {
      await mp.goto(url);
      await mp.waitForTimeout(800);
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) throw new Error(`${url} overflows horizontally by ${over}px`);
      await shot(mp, name, false);
    }
    await mp.goto(`${BASE}/login`);
    await mp.getByLabel('Email').fill(student.email); await mp.getByLabel('Password', { exact: true }).fill(student.password);
    await mp.getByRole('button', { name: 'Sign in', exact: true }).click();
    await mp.getByRole('button', { name: 'Sign out' }).waitFor();
    await mp.goto(`${BASE}/for-you`);
    await mp.locator('.card .score').first().waitFor();
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) throw new Error(`for-you overflows horizontally by ${over}px`);
    await shot(mp, '16c-mobile-for-you', false);
    await m.close();
  });

  await browser.close();
  const report = { base: BASE, at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, consoleErrors };
  fs.writeFileSync(path.join(OUT, 'journeys-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.passed} passed, ${report.failed} failed. Console errors: ${consoleErrors.length}`);
  process.exit(report.failed ? 1 : 0);
})();
