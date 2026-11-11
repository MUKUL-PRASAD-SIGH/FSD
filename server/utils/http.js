// Express 4 does not catch rejected promises; wrap async handlers.
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Never leak stack traces or internals; log them server-side only.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = status < 500 ? err.message : 'Something went wrong on our side';
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  if (err.code === 11000) { status = 409; message = 'That value is already in use'; }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'File too large (max 5 MB)'; }
  if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON'; }
  if (status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err);
  const code = status < 500 && typeof err.code === 'string' && /^[A-Z_]{3,40}$/.test(err.code) ? err.code : undefined;
  res.status(status).json(code ? { error: message, code } : { error: message });
};

module.exports = { asyncRoute, notFound, errorHandler };
