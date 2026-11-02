import React, { useState } from 'react';
import { X, Send, Users, Loader2 } from 'lucide-react';
import { teamService } from '../services/api';
import { useToast } from '../context/ToastContext';

const JoinTeamModal = ({ team, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  if (!team) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await teamService.requestJoin(team._id, { message });
      showToast('Join request successfully sent to team leader!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send join request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Request to Join {team.name}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Led by {team.leaderId?.name || 'Team Leader'}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {team.skillsSeeking && team.skillsSeeking.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Team is actively seeking:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {team.skillsSeeking.map((s, idx) => (
                    <span key={idx} className="skill-pill" style={{ color: '#67e8f9', background: 'rgba(6,182,212,0.1)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Message to Team Leader *</label>
              <textarea
                required
                className="form-textarea"
                rows={3}
                placeholder="Hi! I have extensive experience with React and UI design and would love to contribute to your team..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send Join Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinTeamModal;
