const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFilePath = path.join(logDir, 'server_audit.log');

// ANSI Color helper for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

const getStatusColor = (status) => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
};

// Mask sensitive fields such as password
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(clone)) {
    if (['password', 'token', 'authorization'].includes(key.toLowerCase())) {
      clone[key] = '***MASKED***';
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitizeData(clone[key]);
    }
  }
  return clone;
};

let reqCounter = 0;

const requestLogger = (req, res, next) => {
  const reqId = ++reqCounter;
  const startTime = process.hrtime();
  const timestamp = new Date().toISOString();

  // Extract auth context if available early or via header
  const authHeader = req.headers.authorization;
  const authSummary = authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer (Provided)' : 'Header Attached') : 'Anonymous';

  // Intercept the response finish event
  const originalEnd = res.end;
  let responseBody = null;

  // Intercept json response for logging payload preview if applicable
  const originalJson = res.json;
  res.json = function (body) {
    responseBody = body;
    return originalJson.apply(this, arguments);
  };

  res.end = function (chunk, encoding) {
    const diff = process.hrtime(startTime);
    const durationMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
    const status = res.statusCode;
    const statusColor = getStatusColor(status);

    // Determine final auth user context if attached by authMiddleware
    const userContext = req.user
      ? `User: ${req.user.name || 'N/A'} (ID: ${req.user._id || req.user.id}, Role: ${req.user.role})`
      : `Auth: ${authSummary}`;

    const sanitizedQuery = Object.keys(req.query || {}).length ? JSON.stringify(req.query) : '-';
    const sanitizedBody = Object.keys(req.body || {}).length ? JSON.stringify(sanitizeData(req.body)) : '-';

    // Formatted terminal log block
    const terminalLog = [
      `${colors.dim}--------------------------------------------------------------------------------${colors.reset}`,
      `${colors.bold}${colors.cyan}[REQ #${reqId}]${colors.reset} ${colors.dim}${timestamp}${colors.reset} | ${colors.magenta}${req.method}${colors.reset} ${req.originalUrl || req.url}`,
      `   ${colors.blue}├─ Client IP:${colors.reset} ${req.ip || req.connection.remoteAddress} | ${colors.blue}Context:${colors.reset} ${userContext}`,
      `   ${colors.blue}├─ Query Params:${colors.reset} ${sanitizedQuery}`,
      `   ${colors.blue}├─ Request Body:${colors.reset} ${sanitizedBody}`,
      `   ${colors.blue}└─ Response:${colors.reset} ${statusColor}${status}${colors.reset} | ${colors.yellow}${durationMs} ms${colors.reset} | Status: ${res.statusMessage || ''}`,
    ].join('\n');

    console.log(terminalLog);

    // Also persist structured line to log file for permanent viva proof
    const fileLogEntry = {
      reqId,
      timestamp,
      method: req.method,
      endpoint: req.originalUrl || req.url,
      ip: req.ip,
      user: req.user ? { id: req.user._id, role: req.user.role, email: req.user.email } : null,
      query: req.query,
      body: sanitizeData(req.body),
      statusCode: status,
      durationMs: parseFloat(durationMs),
    };

    fs.appendFile(logFilePath, JSON.stringify(fileLogEntry) + '\n', (err) => {
      if (err) console.error('Failed to write server audit log:', err.message);
    });

    originalEnd.apply(this, arguments);
  };

  next();
};

module.exports = { requestLogger, logFilePath };
