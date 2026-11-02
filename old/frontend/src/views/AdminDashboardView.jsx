import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Users,
  FileText,
  Calendar,
  Building,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { opportunityService, applicationService } from '../services/api';
import { useToast } from '../context/ToastContext';
import AdminOpportunityModal from '../components/AdminOpportunityModal';
import ApplicationReviewModal from '../components/ApplicationReviewModal';

const AdminDashboardView = () => {
  const [activeSubTab, setActiveSubTab] = useState('opportunities'); // 'opportunities' | 'applications'
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Modals state
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [reviewingApplication, setReviewingApplication] = useState(null);

  const { showToast } = useToast();

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await opportunityService.getAll({ search });
      setOpportunities(res.data.opportunities || []);
    } catch (err) {
      showToast('Failed to load opportunities', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationService.getAdminApplications({
        status: selectedStatusFilter,
      });
      setApplications(res.data.applications || []);
    } catch (err) {
      showToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'opportunities') {
      fetchOpportunities();
    } else {
      fetchApplications();
    }
  }, [activeSubTab, selectedStatusFilter]);

  const handleDeleteOpportunity = async (id, title) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${title}"? This will also remove associated applications.`
      )
    ) {
      return;
    }

    try {
      await opportunityService.delete(id);
      showToast('Opportunity deleted successfully', 'info');
      fetchOpportunities();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete opportunity', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}>
              Administrator Privilege
            </span>
          </div>
          <h1 style={{ marginTop: '4px' }}>Opportunity CRUD & Applicant Review</h1>
          <p>
            Create, update, and manage technical opportunities and evaluate candidate dossiers
          </p>
        </div>

        {activeSubTab === 'opportunities' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingOpportunity(null);
              setIsOpportunityModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Post New Opportunity</span>
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`nav-tab ${activeSubTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('opportunities')}
        >
          <Building size={16} />
          <span>Opportunities Management ({opportunities.length})</span>
        </button>

        <button
          className={`nav-tab ${activeSubTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('applications')}
        >
          <Users size={16} />
          <span>Applicant Dossiers ({applications.length})</span>
        </button>
      </div>

      {/* TAB 1: Opportunities Management */}
      {activeSubTab === 'opportunities' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Fetching opportunities database...</p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                      <th style={{ padding: '14px 18px' }}>Title & Company</th>
                      <th style={{ padding: '14px 18px' }}>Domain & Type</th>
                      <th style={{ padding: '14px 18px' }}>Location</th>
                      <th style={{ padding: '14px 18px' }}>Deadline</th>
                      <th style={{ padding: '14px 18px' }}>Applicants</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => (
                      <tr
                        key={opp._id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <strong style={{ color: '#fff', display: 'block' }}>{opp.title}</strong>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{opp.company}</span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span className="badge badge-domain" style={{ marginRight: '4px' }}>
                            {opp.domain}
                          </span>
                          <span className="badge badge-type">{opp.type}</span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>{opp.locationName || opp.locationType}</td>
                        <td style={{ padding: '14px 18px', color: '#06b6d4', fontWeight: 600 }}>
                          {new Date(opp.deadline).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                          {opp.applicantCount || 0}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            className="badge"
                            style={{
                              background: opp.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                              color: opp.status === 'Active' ? '#34d399' : '#fb7185',
                            }}
                          >
                            {opp.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-icon-only"
                              title="Edit Opportunity"
                              onClick={() => {
                                setEditingOpportunity(opp);
                                setIsOpportunityModalOpen(true);
                              }}
                            >
                              <Edit size={14} color="#38bdf8" />
                            </button>
                            <button
                              className="btn btn-danger btn-icon-only"
                              title="Delete Opportunity"
                              onClick={() => handleDeleteOpportunity(opp._id, opp.title)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Applications Review Management */}
      {activeSubTab === 'applications' && (
        <div>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['All', 'Applied', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected'].map((status) => (
              <button
                key={status}
                className={`domain-chip ${selectedStatusFilter === status ? 'active' : ''}`}
                onClick={() => setSelectedStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Loading candidate applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
              }}
            >
              <Users size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#fff', marginBottom: '6px' }}>No applications found</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                No candidate submissions match the current status filter.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                      <th style={{ padding: '14px 18px' }}>Applicant</th>
                      <th style={{ padding: '14px 18px' }}>Target Opportunity</th>
                      <th style={{ padding: '14px 18px' }}>Submitted Date</th>
                      <th style={{ padding: '14px 18px' }}>Current Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Decision Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr
                        key={app._id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <strong style={{ color: '#fff' }}>{app.studentId?.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{app.studentId?.email}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{app.studentId?.college}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{app.opportunityId?.title}</span>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{app.opportunityId?.company}</div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#94a3b8' }}>
                          {new Date(app.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span className={`status-badge status-${app.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {app.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => setReviewingApplication(app)}
                          >
                            Review & Decide
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Opportunity Modal (Create / Edit) */}
      {isOpportunityModalOpen && (
        <AdminOpportunityModal
          opportunity={editingOpportunity}
          onClose={() => setIsOpportunityModalOpen(false)}
          onSaved={fetchOpportunities}
        />
      )}

      {/* Application Review Modal */}
      {reviewingApplication && (
        <ApplicationReviewModal
          application={reviewingApplication}
          onClose={() => setReviewingApplication(null)}
          onUpdated={fetchApplications}
        />
      )}
    </div>
  );
};

export default AdminDashboardView;
