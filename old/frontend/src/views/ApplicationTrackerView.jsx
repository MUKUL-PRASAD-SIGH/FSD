import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Trash2,
  Calendar,
  MessageSquare,
  Award,
  RefreshCw,
} from 'lucide-react';
import { applicationService } from '../services/api';
import { useToast } from '../context/ToastContext';

const STATUS_STAGES = ['Applied', 'Under Review', 'Shortlisted', 'Accepted'];

const ApplicationTrackerView = ({ onExploreMore }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const { showToast } = useToast();

  const fetchMyApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationService.getMyApplications();
      setApplications(res.data.applications || []);
    } catch (err) {
      showToast('Failed to load your applications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyApplications();
  }, []);

  const handleWithdraw = async (id, title) => {
    if (!window.confirm(`Are you sure you want to withdraw your application for "${title}"?`)) {
      return;
    }

    try {
      await applicationService.withdraw(id);
      showToast('Application withdrawn successfully', 'info');
      fetchMyApplications();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to withdraw application', 'error');
    }
  };

  const filteredApps =
    selectedFilter === 'All'
      ? applications
      : applications.filter((app) => app.status === selectedFilter);

  // Metrics
  const totalCount = applications.length;
  const underReviewCount = applications.filter((a) => a.status === 'Under Review').length;
  const shortlistedCount = applications.filter((a) => a.status === 'Shortlisted').length;
  const acceptedCount = applications.filter((a) => a.status === 'Accepted').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>My Application Status Tracker</h1>
          <p>
            Monitor submission status, review stages, and committee feedback in real-time
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchMyApplications}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Tracker</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="analytics-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
            <FileText size={22} color="#22d3ee" />
          </div>
          <div>
            <div className="stat-val">{totalCount}</div>
            <div className="stat-title">Total Submitted</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
            <Clock size={22} color="#fbbf24" />
          </div>
          <div>
            <div className="stat-val">{underReviewCount}</div>
            <div className="stat-title">Under Review</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
            <Award size={22} color="#c084fc" />
          </div>
          <div>
            <div className="stat-val">{shortlistedCount}</div>
            <div className="stat-title">Shortlisted Candidates</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
            <CheckCircle2 size={22} color="#34d399" />
          </div>
          <div>
            <div className="stat-val">{acceptedCount}</div>
            <div className="stat-title">Accepted / Offers</div>
          </div>
        </div>
      </div>

      {/* Status filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['All', 'Applied', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected'].map((status) => (
          <button
            key={status}
            className={`domain-chip ${selectedFilter === status ? 'active' : ''}`}
            onClick={() => setSelectedFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading application tracking telemetry...</p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
          }}
        >
          <FileText size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#fff', marginBottom: '6px' }}>No applications in this category</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Browse active technical opportunities and submit an application!
          </p>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: '16px' }}
            onClick={onExploreMore}
          >
            Explore Opportunities
          </button>
        </div>
      ) : (
        <div className="applications-list">
          {filteredApps.map((app) => {
            const currentStageIndex = STATUS_STAGES.indexOf(app.status);
            const statusClass = `status-${app.status.toLowerCase().replace(/\s+/g, '-')}`;

            return (
              <div key={app._id} className="application-card">
                <div className="app-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-domain">
                        {app.opportunityId?.domain || 'Technical'}
                      </span>
                      <span className="badge badge-type">
                        {app.opportunityId?.type || 'Hackathon'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                      {app.opportunityId?.title || 'Opportunity'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      <Building size={14} />
                      <span>{app.opportunityId?.company}</span>
                      <span>•</span>
                      <Calendar size={14} />
                      <span>Submitted on {new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`status-badge ${statusClass}`}>{app.status}</span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleWithdraw(app._id, app.opportunityId?.title)}
                      title="Withdraw application"
                    >
                      <Trash2 size={14} />
                      <span>Withdraw</span>
                    </button>
                  </div>
                </div>

                {/* Progress Stages Bar */}
                {app.status !== 'Rejected' ? (
                  <div className="timeline-stepper">
                    {STATUS_STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStageIndex;
                      const isActive = idx === currentStageIndex;
                      return (
                        <div key={stage} className="timeline-step">
                          <div
                            className={`step-indicator ${
                              isCompleted ? 'completed' : isActive ? 'active' : ''
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 size={13} /> : idx + 1}
                          </div>
                          <span
                            className={`step-label ${
                              isActive ? 'active' : isCompleted ? 'completed' : ''
                            }`}
                          >
                            {stage}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#fb7185',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>Application not selected for final cohort. Thank you for applying!</span>
                  </div>
                )}

                {/* Administrator Feedback Note */}
                {app.feedback && (
                  <div
                    style={{
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginTop: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      <MessageSquare size={14} />
                      <span>Feedback from Selection Committee</span>
                    </div>
                    <p style={{ color: '#e2e8f0', fontSize: '0.88rem' }}>{app.feedback}</p>
                  </div>
                )}

                {/* Timeline History */}
                {app.timeline && app.timeline.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Timeline Audit:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {app.timeline.map((entry, tIdx) => (
                        <div
                          key={tIdx}
                          style={{
                            fontSize: '0.78rem',
                            color: '#94a3b8',
                            display: 'flex',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          <span style={{ color: '#818cf8', fontWeight: 600 }}>{entry.status}</span>
                          <span>•</span>
                          <span>{entry.note}</span>
                          <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicationTrackerView;
