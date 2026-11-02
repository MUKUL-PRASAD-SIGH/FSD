// npm run integrations:check  -> makes a real request to every configured integration and prints the result.
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { checkAll } = require('../services/integrations');

(async () => {
  try { await connectDB(); } catch (e) { console.error(`MongoDB: ${e.message}`); }
  const rows = await checkAll(process.argv.slice(2).length ? process.argv.slice(2) : undefined);
  console.table(rows.map((r) => ({ integration: r.name, status: r.configured ? (r.ok ? 'OK' : 'FAILED') : 'not configured', detail: r.detail, ms: r.ms ?? '' })));
  await mongoose.disconnect().catch(() => {});
  process.exit(rows.some((r) => r.configured && !r.ok) ? 1 : 0);
})();
