import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Loader2 } from 'lucide-react';
import { opportunityService } from '../services/api';
import { useToast } from '../context/ToastContext';

const AdminOpportunityModal = ({ opportunity, onClose, onSaved }) => {
  const isEditing = !!opportunity;
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    type: 'Hackathon',
    domain: 'AI/ML',
    locationType: 'Remote',
    locationName: 'Worldwide Virtual',
    reward: '$10,000 Prize Pool',
    deadline: '',
    eligibility: 'Open to college students & recent grads',
    skillsRequired: '',
    tags: '',
    status: 'Active',
  });

  useEffect(() => {
    if (opportunity) {
      setFormData({
        title: opportunity.title || '',
        company: opportunity.company || '',
        description: opportunity.description || '',
        type: opportunity.type || 'Hackathon',
        domain: opportunity.domain || 'AI/ML',
        locationType: opportunity.locationType || 'Remote',
        locationName: opportunity.locationName || 'Worldwide Virtual',
        reward: opportunity.reward || '',
        deadline: opportunity.deadline ? opportunity.deadline.substring(0, 10) : '',
        eligibility: opportunity.eligibility || '',
        skillsRequired: Array.isArray(opportunity.skillsRequired)
          ? opportunity.skillsRequired.join(', ')
          : '',
        tags: Array.isArray(opportunity.tags) ? opportunity.tags.join(', ') : '',
        status: opportunity.status || 'Active',
      });
    }
  }, [opportunity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isEditing) {
        await opportunityService.update(opportunity._id, formData);
        showToast('Opportunity updated successfully!', 'success');
      } else {
        await opportunityService.create(formData);
        showToast('New opportunity published successfully!', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save opportunity';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEditing ? 'Edit Opportunity' : 'Publish New Technical Opportunity'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Opportunity management
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Opportunity Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Next-Gen Cloud Hackathon 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company / Organizing Entity *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Microsoft Azure / IEEE"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description & Problem Statement *</label>
              <textarea
                required
                className="form-textarea"
                rows={3}
                placeholder="Detailed objectives, problem statements, and requirements..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Hackathon">Hackathon</option>
                  <option value="Internship">Internship</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Coding Contest">Coding Contest</option>
                  <option value="Research Grant">Research Grant</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Domain *</label>
                <select
                  className="form-select"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                >
                  <option value="AI/ML">AI/ML</option>
                  <option value="Web Development">Web Development</option>
                  <option value="Cloud & DevOps">Cloud & DevOps</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                  <option value="Blockchain & Web3">Blockchain & Web3</option>
                  <option value="Mobile Development">Mobile Development</option>
                  <option value="Data Science">Data Science</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location Type *</label>
                <select
                  className="form-select"
                  value={formData.locationType}
                  onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Reward / Stipend *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. $15,000 Cash Pool or $5,000/mo"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Application Deadline *</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Required Skills (comma-separated)</label>
              <input
                type="text"
                className="form-input"
                placeholder="React, Node.js, PyTorch, Docker"
                value={formData.skillsRequired}
                onChange={(e) => setFormData({ ...formData, skillsRequired: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Hackathon, Cloud, Tier1"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
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
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isEditing ? 'Save Changes' : 'Publish Opportunity'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminOpportunityModal;
