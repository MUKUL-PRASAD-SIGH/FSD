import React, { useState } from 'react';
import { X, Check, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { applicationService } from '../services/api';
import { useToast } from '../context/ToastContext';

const ApplicationReviewModal = ({ application, onClose, onUpdated }) => {
  if (!application) return null;

  const [status, setStatus] = useState(application.status || 'Applied');
  const [feedback, setFeedback] = useState(application.feedback || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await applicationService.updateStatus(application._id, {
        status,
        feedback,
        note,
      });
      showToast(`Application updated to ${status}!`, 'success');
      onUpdated();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update application', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Review Applicant Dossier</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              For: {application.opportunityId?.title}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="modal-body">
            {/* Student Profile Card */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: '#fff', fontSize: '1.05rem' }}>{application.studentId?.name}</h3>
                <span className="badge badge-domain">{application.studentId?.college || 'University Student'}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
                Email: {application.studentId?.email}
              </div>
              {application.studentId?.skills && application.studentId.skills.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {application.studentId.skills.map((s, idx) => (
                    <span key={idx} className="skill-pill">{s}</span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Submitted Pitch / Statement</label>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: '0.88rem', whiteSpace: 'pre-line' }}>
                {application.coverNote || 'No custom statement provided.'}
              </div>
            </div>

            {application.resumeUrl && (
              <div>
                <label className="form-label">Resume / Proposal Document</label>
                <a
                  href={`http://localhost:5001${application.resumeUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', gap: '6px', textDecoration: 'none' }}
                >
                  <FileText size={14} color="#38bdf8" />
                  <span>Download / View Uploaded Document</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Update Status *</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Applied">Applied</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Timeline Status Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Advanced to Round 2 Evaluation"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Feedback to Student (Visible on their tracker)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Constructive feedback or next steps instructions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Close
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Save Review Decision</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplicationReviewModal;
