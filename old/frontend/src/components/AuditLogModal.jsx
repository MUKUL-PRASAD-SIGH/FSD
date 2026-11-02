import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal, CheckCircle2, Clock } from 'lucide-react';
import { auditLogService } from '../services/api';

const AuditLogModal = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditLogService.getRecentLogs();
      setLogs(res.data.recentLogs || []);
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon" style={{ width: '32px', height: '32px', background: '#1e293b' }}>
              <Terminal size={18} color="#38bdf8" />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>
                Server Audit Log
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Live request and response activity
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.82rem', color: '#bae6fd' }}>
            This panel shows live server logs, including HTTP method, route, authenticated user, duration (ms) and status code.
          </div>

          <div className="terminal-window">
            {logs.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                No server audit entries logged yet. Perform an action like browsing or logging in to trigger entries.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="terminal-entry">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <div>
                      <span className={`terminal-method ${log.method}`}>{log.method}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{log.endpoint}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: log.statusCode >= 400 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                        {log.statusCode} OK
                      </span>
                      <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} />
                        {log.durationMs}ms
                      </span>
                    </div>
                  </div>

                  <div style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>Timestamp: {new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>Client IP: {log.ip}</span>
                    <span>
                      User Context:{' '}
                      <strong style={{ color: log.user ? '#818cf8' : '#94a3b8' }}>
                        {log.user ? `${log.user.email} (${log.user.role})` : 'Anonymous / Guest'}
                      </strong>
                    </span>
                  </div>

                  {log.body && Object.keys(log.body).length > 0 && (
                    <div style={{ color: '#cbd5e1', fontSize: '0.72rem', marginTop: '3px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '4px' }}>
                      Body: {JSON.stringify(log.body)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Audit log file: <code>backend/logs/server_audit.log</code>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogModal;
