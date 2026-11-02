import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Briefcase,
  CheckCircle2,
  Calendar,
  Building,
  RefreshCw,
  Award,
} from 'lucide-react';
import { analyticsService } from '../services/api';
import { useToast } from '../context/ToastContext';

const AnalyticsView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDomain, setFilterDomain] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const { showToast } = useToast();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getOverview({
        domain: filterDomain,
        locationType: filterLocation,
        type: filterType,
      });
      setData(res.data);
    } catch (err) {
      showToast('Failed to load analytics dashboard telemetry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [filterDomain, filterLocation, filterType]);

  const maxDomainCount = data?.charts?.domainBreakdown?.reduce(
    (max, item) => Math.max(max, item.count),
    1
  ) || 1;

  const maxTypeCount = data?.charts?.typeBreakdown?.reduce(
    (max, item) => Math.max(max, item.count),
    1
  ) || 1;

  const maxCompanyApplicants = data?.charts?.topCompanies?.reduce(
    (max, item) => Math.max(max, item.applicants || 1),
    1
  ) || 1;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Analytics & Ecosystem Intelligence</h1>
          <p>
            Real-time aggregated KPIs, technical domain distributions, and applicant funnels
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchAnalytics}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ padding: '14px 20px', marginBottom: '24px' }}>
        <div className="filter-controls-row">
          <div className="filter-selects">
            <select
              className="custom-select"
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
            >
              <option value="All">All Domains</option>
              <option value="AI/ML">AI/ML</option>
              <option value="Web Development">Web Development</option>
              <option value="Cloud & DevOps">Cloud & DevOps</option>
              <option value="Cybersecurity">Cybersecurity</option>
              <option value="Blockchain & Web3">Blockchain & Web3</option>
              <option value="Mobile Development">Mobile Development</option>
              <option value="Data Science">Data Science</option>
            </select>

            <select
              className="custom-select"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            >
              <option value="All">All Locations</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>

            <select
              className="custom-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Hackathon">Hackathons</option>
              <option value="Internship">Internships</option>
              <option value="Full-time">Full-time Roles</option>
              <option value="Coding Contest">Coding Contests</option>
              <option value="Research Grant">Research Grants</option>
            </select>
          </div>

          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Data source: <strong>MongoDB Aggregate Pipelines</strong>
          </span>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Compiling database analytics charts...</p>
        </div>
      ) : (
        <>
          {/* Key Metric KPI Cards */}
          <div className="analytics-stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                <Briefcase size={22} color="#818cf8" />
              </div>
              <div>
                <div className="stat-val">{data.kpis.totalOpportunities}</div>
                <div className="stat-title">Total Opportunities</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <TrendingUp size={22} color="#34d399" />
              </div>
              <div>
                <div className="stat-val">{data.kpis.activeOpportunities}</div>
                <div className="stat-title">Active Opportunities</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                <Users size={22} color="#22d3ee" />
              </div>
              <div>
                <div className="stat-val">{data.kpis.totalStudents}</div>
                <div className="stat-title">Enrolled Students</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                <BarChart3 size={22} color="#fbbf24" />
              </div>
              <div>
                <div className="stat-val">{data.kpis.totalApplications}</div>
                <div className="stat-title">Total Applications</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                <CheckCircle2 size={22} color="#c084fc" />
              </div>
              <div>
                <div className="stat-val">{data.kpis.acceptanceRate}</div>
                <div className="stat-title">Acceptance Rate</div>
              </div>
            </div>
          </div>

          {/* Charts Row 1: Domain Distribution & Application Status Funnel */}
          <div className="charts-grid">
            {/* Domain Breakdown Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Opportunities by Technical Domain</h3>
                <span className="badge badge-domain">Categorical Distribution</span>
              </div>
              <div>
                {data.charts.domainBreakdown.map((item, idx) => {
                  const percent = Math.round((item.count / maxDomainCount) * 100);
                  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#3b82f6'];
                  const barColor = colors[idx % colors.length];

                  return (
                    <div key={item.label} className="bar-row">
                      <div className="bar-label-group">
                        <span style={{ color: '#cbd5e1' }}>{item.label}</span>
                        <span style={{ color: '#94a3b8' }}>
                          <strong>{item.count}</strong> listings ({item.applicants} applicants)
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${percent}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Application Status Funnel */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Candidate Selection Funnel</h3>
                <span className="badge badge-type">Pipeline Conversion</span>
              </div>
              <div>
                {data.charts.applicationStatusFunnel.map((item) => {
                  const statusColors = {
                    Applied: '#22d3ee',
                    'Under Review': '#fbbf24',
                    Shortlisted: '#c084fc',
                    Accepted: '#34d399',
                    Rejected: '#fb7185',
                  };
                  const color = statusColors[item.status] || '#818cf8';
                  const total = data.kpis.totalApplications || 1;
                  const percent = Math.round((item.count / total) * 100);

                  return (
                    <div key={item.status} className="bar-row">
                      <div className="bar-label-group">
                        <span style={{ color: '#cbd5e1' }}>{item.status}</span>
                        <span style={{ color: '#94a3b8' }}>
                          <strong>{item.count}</strong> candidates ({percent}%)
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${percent}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Opportunity Types & Work Mode */}
          <div className="charts-grid">
            {/* Opportunity Types */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Format Distribution (Hackathon / Internships / Grants)</h3>
              </div>
              <div>
                {data.charts.typeBreakdown.map((item, idx) => {
                  const percent = Math.round((item.count / maxTypeCount) * 100);
                  const colors = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ec4899'];
                  return (
                    <div key={item.label} className="bar-row">
                      <div className="bar-label-group">
                        <span style={{ color: '#cbd5e1' }}>{item.label}</span>
                        <span style={{ color: '#94a3b8' }}>
                          <strong>{item.count}</strong> programs
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${percent}%`, backgroundColor: colors[idx % colors.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Location Types */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Workplace Modality</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '14px' }}>
                {data.charts.locationBreakdown.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                      {item.count}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginTop: '4px' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row: Upcoming Deadlines & Top Companies */}
          <div className="charts-grid">
            {/* Top Companies */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Top Hiring Companies & Hackathon Organizers</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.charts.topCompanies.map((comp, idx) => (
                  <div
                    key={comp.company}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.9rem' }}>
                        #{idx + 1}
                      </span>
                      <strong style={{ color: '#fff' }}>{comp.company}</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      <strong>{comp.listings}</strong> listings • <strong>{comp.applicants}</strong> applicants
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Upcoming Application Deadlines</h3>
                <span className="badge badge-status-active">Next 30 Days</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.upcomingDeadlines.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No immediate deadlines in the next 30 days.</div>
                ) : (
                  data.upcomingDeadlines.map((opp) => (
                    <div
                      key={opp._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.88rem', display: 'block' }}>
                          {opp.title}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {opp.company} • {opp.reward}
                        </span>
                      </div>
                      <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.85rem' }}>
                        {new Date(opp.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsView;
