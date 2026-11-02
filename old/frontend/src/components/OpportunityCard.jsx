import React from 'react';
import { Bookmark, MapPin, Calendar, Award, Building, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OpportunityCard = ({
  opportunity,
  isSaved,
  onToggleSave,
  onViewDetails,
  onApply,
  userApplied,
}) => {
  const { isAuthenticated, isStudent } = useAuth();

  const deadlineFormatted = new Date(opportunity.deadline).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  );

  const daysLeft = Math.ceil(
    (new Date(opportunity.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="opportunity-card">
      <div>
        <div className="card-top">
          <div className="card-tags-row">
            <span className="badge badge-domain">{opportunity.domain}</span>
            <span className="badge badge-type">{opportunity.type}</span>
            <span className="badge badge-status-active">
              {opportunity.locationType}
            </span>
          </div>

          {isAuthenticated && isStudent && (
            <button
              className={`badge-bookmark ${isSaved ? 'saved' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(opportunity._id);
              }}
              title={isSaved ? 'Remove from bookmarks' : 'Save opportunity'}
            >
              <Bookmark size={18} fill={isSaved ? '#f59e0b' : 'none'} />
            </button>
          )}
        </div>

        <h3 className="card-title">{opportunity.title}</h3>

        <div className="card-company">
          <Building size={14} color="#94a3b8" />
          <span>{opportunity.company}</span>
        </div>

        <p className="card-description">{opportunity.description}</p>

        <div className="card-meta-list">
          <div className="meta-item">
            <Award size={14} color="#f59e0b" />
            <span>Reward: <strong>{opportunity.reward}</strong></span>
          </div>
          <div className="meta-item">
            <Calendar size={14} color="#06b6d4" />
            <span>
              Deadline: <strong>{deadlineFormatted}</strong>{' '}
              <span style={{ color: daysLeft < 7 ? '#f43f5e' : '#10b981', fontSize: '0.75rem' }}>
                ({daysLeft > 0 ? `${daysLeft} days left` : 'Due today'})
              </span>
            </span>
          </div>
          <div className="meta-item">
            <MapPin size={14} color="#a855f7" />
            <span>Location: <strong>{opportunity.locationName || opportunity.locationType}</strong></span>
          </div>
        </div>

        {opportunity.skillsRequired && opportunity.skillsRequired.length > 0 && (
          <div className="card-skills-row">
            {opportunity.skillsRequired.slice(0, 4).map((skill, index) => (
              <span key={index} className="skill-pill">
                {skill}
              </span>
            ))}
            {opportunity.skillsRequired.length > 4 && (
              <span className="skill-pill" style={{ color: '#94a3b8' }}>
                +{opportunity.skillsRequired.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="card-actions">
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1 }}
          onClick={() => onViewDetails(opportunity)}
        >
          View Details
        </button>

        {userApplied ? (
          <button
            className="btn btn-sm"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              cursor: 'default',
            }}
          >
            <CheckCircle size={14} />
            <span>Applied</span>
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() => onApply(opportunity)}
          >
            Apply Now
          </button>
        )}
      </div>
    </div>
  );
};

export default OpportunityCard;
