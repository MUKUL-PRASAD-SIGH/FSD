const AuditLog = require('../models/AuditLog');

// Fire-and-forget: auditing must never break the request it is recording.
function audit(req, action, { actor, target, meta } = {}) {
  return AuditLog.create({
    actor: actor?._id || actor || req?.user?._id,
    action,
    target: target ? String(target) : undefined,
    meta,
    ip: req?.ip,
  }).catch((e) => console.error('audit failed:', e.message));
}

module.exports = { audit };
