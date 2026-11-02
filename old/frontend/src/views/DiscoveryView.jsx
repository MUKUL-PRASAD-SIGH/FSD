import React, { useState, useEffect } from 'react';
import { Search, Filter, Bookmark, Sparkles, RefreshCw } from 'lucide-react';
import OpportunityCard from '../components/OpportunityCard';
import { opportunityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DOMAINS = [
  'All',
  'AI/ML',
  'Web Development',
  'Cloud & DevOps',
  'Cybersecurity',
  'Blockchain & Web3',
  'Mobile Development',
  'Data Science',
];

const DiscoveryView = ({ onSelectOpportunity, onApplyOpportunity }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('deadline_asc');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());

  const { isAuthenticated, isStudent } = useAuth();
  const { showToast } = useToast();

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      if (showSavedOnly) {
        const res = await opportunityService.getSaved();
        setOpportunities(res.data.opportunities || []);
      } else {
        const params = {
          search,
          domain: selectedDomain,
          type: selectedType,
          locationType: selectedLocation,
          sort: sortBy,
        };
        const res = await opportunityService.getAll(params);
        setOpportunities(res.data.opportunities || []);
      }
    } catch (err) {
      showToast('Failed to fetch opportunities', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStatus = async () => {
    if (isAuthenticated && isStudent) {
      try {
        const savedRes = await opportunityService.getSaved();
        const ids = new Set((savedRes.data.opportunities || []).map((o) => o._id));
        setSavedIds(ids);
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [selectedDomain, selectedType, selectedLocation, sortBy, showSavedOnly]);

  useEffect(() => {
    fetchUserStatus();
  }, [isAuthenticated]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOpportunities();
  };

  const handleToggleSave = async (id) => {
    try {
      const res = await opportunityService.toggleSave(id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.data.saved) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast(res.data.message, 'info');
      if (showSavedOnly) fetchOpportunities();
    } catch (err) {
      showToast('Failed to update bookmark', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Technical Opportunities Feed</h1>
          <p>
            Explore verified hackathons, internships, fellowships, and research grants
          </p>
        </div>

        {isAuthenticated && isStudent && (
          <button
            className={`btn ${showSavedOnly ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowSavedOnly(!showSavedOnly)}
          >
            <Bookmark size={15} fill={showSavedOnly ? '#fff' : 'none'} />
            <span>{showSavedOnly ? 'Showing Saved' : 'Bookmarked Opportunities'}</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by keywords, tech stack, company, or domain (Press Enter)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Domain Chips */}
        <div className="domain-chips">
          {DOMAINS.map((domain) => (
            <button
              key={domain}
              className={`domain-chip ${selectedDomain === domain ? 'active' : ''}`}
              onClick={() => {
                setShowSavedOnly(false);
                setSelectedDomain(domain);
              }}
            >
              {domain}
            </button>
          ))}
        </div>

        {/* Controls Row */}
        <div className="filter-controls-row">
          <div className="filter-selects">
            <select
              className="custom-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All">All Opportunity Types</option>
              <option value="Hackathon">Hackathons</option>
              <option value="Internship">Internships</option>
              <option value="Full-time">Full-time Roles</option>
              <option value="Coding Contest">Coding Contests</option>
              <option value="Research Grant">Research Grants</option>
            </select>

            <select
              className="custom-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="All">All Locations</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>

            <select
              className="custom-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="deadline_asc">Deadline: Soonest First</option>
              <option value="deadline_desc">Deadline: Latest First</option>
              <option value="newest">Newest Published</option>
              <option value="popularity">Most Applicants</option>
            </select>
          </div>

          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Found <strong>{opportunities.length}</strong> opportunities
          </span>
        </div>
      </div>

      {/* Grid of Opportunities */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Querying verified opportunities...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
          }}
        >
          <Sparkles size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#fff', marginBottom: '6px' }}>No matching opportunities found</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Try resetting your search filters or browse across all technical domains.
          </p>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '16px' }}
            onClick={() => {
              setSearch('');
              setSelectedDomain('All');
              setSelectedType('All');
              setSelectedLocation('All');
              setShowSavedOnly(false);
            }}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="opportunities-grid">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp._id}
              opportunity={opp}
              isSaved={savedIds.has(opp._id)}
              onToggleSave={handleToggleSave}
              onViewDetails={onSelectOpportunity}
              onApply={onApplyOpportunity}
              userApplied={appliedIds.has(opp._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscoveryView;
