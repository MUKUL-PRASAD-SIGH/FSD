// Express 4 does not catch rejected promises; wrap async handlers.
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'File too large (max 5 MB)'; }
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
};

module.exports = { asyncRoute, notFound, errorHandler };
