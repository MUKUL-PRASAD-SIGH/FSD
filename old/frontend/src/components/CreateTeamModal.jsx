import React, { useState } from 'react';
import { X, Users, Upload, Plus, Loader2 } from 'lucide-react';
import { teamService } from '../services/api';
import { useToast } from '../context/ToastContext';

const CreateTeamModal = ({ opportunities, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [description, setDescription] = useState('');
  const [skillsSeeking, setSkillsSeeking] = useState('');
  const [maxMembers, setMaxMembers] = useState(4);
  const [projectPitch, setProjectPitch] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      if (opportunityId) formData.append('opportunityId', opportunityId);
      formData.append('description', description);
      formData.append('skillsSeeking', skillsSeeking);
      formData.append('maxMembers', maxMembers);
      formData.append('projectPitch', projectPitch);
      if (attachmentFile) {
        formData.append('attachment', attachmentFile);
      }

      await teamService.create(formData);
      showToast('Team created successfully!', 'success');
      onCreated();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create team', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create Collaborative Hackathon Team</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Assemble talent, pitch your concept, and compete together
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Team Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Quantum Pioneers"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Hackathon or Opportunity (Optional)</label>
              <select
                className="form-select"
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
              >
                <option value="">General Project / Open Collaboration</option>
                {opportunities.map((opp) => (
                  <option key={opp._id} value={opp._id}>
                    {opp.title} ({opp.company})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Project Concept & Mission *</label>
              <textarea
                required
                className="form-textarea"
                rows={3}
                placeholder="What are you building? What problem does your team solve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Skills You Are Seeking</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="UI/UX, Backend, DevOps, PyTorch"
                  value={skillsSeeking}
                  onChange={(e) => setSkillsSeeking(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Members Capacity</label>
                <input
                  type="number"
                  min="2"
                  max="6"
                  className="form-input"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Team Pitch Deck or Architecture Document (Optional)</label>
              <label className="file-upload-box">
                <Upload size={24} color="#818cf8" />
                <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                  {attachmentFile ? attachmentFile.name : 'Upload concept pitch or design slide (PDF/Image)'}
                </span>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAttachmentFile(e.target.files[0]);
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
                  <span>Creating Team...</span>
                </>
              ) : (
                <>
                  <Users size={16} />
                  <span>Form Team</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamModal;
