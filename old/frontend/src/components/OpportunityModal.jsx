import React from 'react';
import { X, Building, Calendar, Award, MapPin, CheckCircle, ExternalLink, Bookmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OpportunityModal = ({
  opportunity,
  onClose,
  onApply,
  userApplied,
  isSaved,
  onToggleSave,
}) => {
  const { isAuthenticated, isStudent } = useAuth();
  if (!opportunity) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-domain">{opportunity.domain}</span>
              <span className="badge badge-type">{opportunity.type}</span>
              <span className="badge badge-status-active">{opportunity.locationType}</span>
            </div>
            <h2 className="modal-title">{opportunity.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
              <Building size={14} />
              <span>{opportunity.company}</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="card-meta-list" style={{ gridTemplateColumns: 'repeat(2, 1fr)', display: 'grid' }}>
            <div className="meta-item">
              <Award size={16} color="#f59e0b" />
              <span>Reward: <strong>{opportunity.reward}</strong></span>
            </div>
            <div className="meta-item">
              <Calendar size={16} color="#06b6d4" />
              <span>Deadline: <strong>{new Date(opportunity.deadline).toLocaleDateString()}</strong></span>
            </div>
            <div className="meta-item">
              <MapPin size={16} color="#a855f7" />
              <span>Location: <strong>{opportunity.locationName || opportunity.locationType}</strong></span>
            </div>
            <div className="meta-item">
              <CheckCircle size={16} color="#10b981" />
              <span>Status: <strong>{opportunity.status}</strong></span>
            </div>
          </div>

          <div>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '8px' }}>About this Opportunity</h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {opportunity.description}
            </p>
          </div>

          {opportunity.eligibility && (
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '6px' }}>Eligibility Criteria</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{opportunity.eligibility}</p>
            </div>
          )}

          {opportunity.skillsRequired && opportunity.skillsRequired.length > 0 && (
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '8px' }}>Required Technical Skills</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {opportunity.skillsRequired.map((s, idx) => (
                  <span key={idx} className="skill-pill" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {opportunity.tags && opportunity.tags.length > 0 && (
            <div>
              <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '8px' }}>Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {opportunity.tags.map((t, idx) => (
                  <span key={idx} style={{ fontSize: '0.75rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isAuthenticated && isStudent && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onToggleSave(opportunity._id)}
            >
              <Bookmark size={15} fill={isSaved ? '#f59e0b' : 'none'} color={isSaved ? '#f59e0b' : '#cbd5e1'} />
              <span>{isSaved ? 'Saved' : 'Bookmark'}</span>
            </button>
          )}

          {userApplied ? (
            <button className="btn btn-sm" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }} disabled>
              <CheckCircle size={15} />
              <span>Already Applied</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose();
                onApply(opportunity);
              }}
            >
              Apply to Opportunity
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpportunityModal;
