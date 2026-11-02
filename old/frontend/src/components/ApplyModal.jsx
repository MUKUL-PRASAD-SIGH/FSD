import React, { useState } from 'react';
import { X, Upload, FileText, Send, Loader2 } from 'lucide-react';
import { applicationService } from '../services/api';
import { useToast } from '../context/ToastContext';

const ApplyModal = ({ opportunity, onClose, onSuccess }) => {
  const [coverNote, setCoverNote] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  if (!opportunity) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('coverNote', coverNote);
      formData.append('portfolioLinks', portfolioLinks);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await applicationService.apply(opportunity._id, formData);
      showToast(res.data.message || 'Application submitted successfully!', 'success');
      onSuccess(opportunity._id);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit application';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge badge-domain" style={{ marginBottom: '4px' }}>
              Submit Application
            </span>
            <h2 className="modal-title">{opportunity.title}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{opportunity.company}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Elevator Pitch & Why You're a Great Fit *</label>
              <textarea
                className="form-textarea"
                required
                placeholder="Describe your background, matching skills, previous hackathon or project experience..."
                rows={4}
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
              />
              <span className="form-hint">Tip: Quantify your results and mention your key technical stack.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Portfolio & Project Links</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/username, https://linkedin.com/in/username"
                value={portfolioLinks}
                onChange={(e) => setPortfolioLinks(e.target.value)}
              />
              <span className="form-hint">Separate multiple links with commas.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Resume / Proposal Document Upload (PDF, DOCX)</label>
              <label className="file-upload-box">
                <Upload size={28} color="#818cf8" />
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                  {resumeFile ? resumeFile.name : 'Click to select resume or project document'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Supports PDF, DOC, DOCX up to 10MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setResumeFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyModal;
