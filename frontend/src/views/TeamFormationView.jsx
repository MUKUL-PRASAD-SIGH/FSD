import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  UserCheck,
  FileText,
  Clock,
  Check,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { teamService, opportunityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import CreateTeamModal from '../components/CreateTeamModal';
import JoinTeamModal from '../components/JoinTeamModal';

const TeamFormationView = () => {
  const [teams, setTeams] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTeamToJoin, setSelectedTeamToJoin] = useState(null);

  const { user, isAuthenticated, isStudent } = useAuth();
  const { showToast } = useToast();

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await teamService.getAll({ search });
      setTeams(res.data.teams || []);

      const oppRes = await opportunityService.getAll({ type: 'Hackathon' });
      setOpportunities(oppRes.data.opportunities || []);
    } catch (err) {
      showToast('Failed to load teams', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleManageRequest = async (teamId, requestId, status) => {
    try {
      await teamService.manageRequest(teamId, requestId, { status });
      showToast(`Join request ${status}!`, 'success');
      fetchTeams();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update request', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Hackathon Team Formation Hub</h1>
          <p>
            Connect with peers, assemble diverse skill sets, and submit collaborative pitches
          </p>
        </div>

        {isAuthenticated && isStudent && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            <span>Form New Team</span>
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="filter-bar" style={{ marginBottom: '24px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTeams();
          }}
          className="search-input-wrapper"
        >
          <Search size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search teams by project concept, team name, or required skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Discovering collaborative teams...</p>
        </div>
      ) : teams.length === 0 ? (
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
          <h3 style={{ color: '#fff', marginBottom: '6px' }}>No teams found</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Be the first to create a team for an upcoming hackathon!
          </p>
          {isAuthenticated && isStudent && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '16px' }}
              onClick={() => setIsCreateOpen(true)}
            >
              Form a Team Now
            </button>
          )}
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map((team) => {
            const isLeader = user && team.leaderId?._id === user._id;
            const isMember =
              user &&
              team.members.some((m) => m.user?._id === user._id || m.user === user._id);
            const isFull = team.members.length >= team.maxMembers;

            return (
              <div key={team._id} className="team-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-domain" style={{ marginBottom: '4px' }}>
                        {team.opportunityId?.title || 'Open Hackathon Team'}
                      </span>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                        {team.name}
                      </h3>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                        Led by <strong>{team.leaderId?.name || 'Leader'}</strong> ({team.leaderId?.college || 'University'})
                      </div>
                    </div>

                    <span
                      className="badge"
                      style={{
                        background: isFull ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                        color: isFull ? '#fb7185' : '#34d399',
                      }}
                    >
                      {team.members.length} / {team.maxMembers} Members
                    </span>
                  </div>

                  <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '14px 0', lineHeight: '1.5' }}>
                    {team.description}
                  </p>

                  {/* Skills Seeking */}
                  {team.skillsSeeking && team.skillsSeeking.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Looking for teammates with:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {team.skillsSeeking.map((s, idx) => (
                          <span key={idx} className="skill-pill" style={{ color: '#67e8f9', background: 'rgba(6,182,212,0.1)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachment if present */}
                  {team.attachmentUrl && (
                    <div style={{ marginBottom: '14px' }}>
                      <a
                        href={`http://localhost:5001${team.attachmentUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', textDecoration: 'none' }}
                      >
                        <FileText size={13} color="#38bdf8" />
                        <span>View Pitch Document</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}

                  {/* Members Roster */}
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Roster:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {team.members.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <UserCheck size={12} color="#10b981" />
                          <span>{m.user?.name || 'Member'}</span>
                          <span style={{ color: '#64748b' }}>({m.roleTitle})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Leader's view: Manage pending requests */}
                  {isLeader && team.requests && team.requests.filter((r) => r.status === 'pending').length > 0 && (
                    <div style={{ marginTop: '14px', background: 'rgba(99,102,241,0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', display: 'block', marginBottom: '6px' }}>
                        Pending Join Requests ({team.requests.filter((r) => r.status === 'pending').length}):
                      </span>
                      {team.requests
                        .filter((r) => r.status === 'pending')
                        .map((req) => (
                          <div key={req._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.8rem' }}>
                            <div>
                              <strong style={{ color: '#fff' }}>{req.user?.name}</strong>: "{req.message}"
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => handleManageRequest(team._id, req._id, 'accepted')}
                              >
                                <Check size={12} /> Accept
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                                onClick={() => handleManageRequest(team._id, req._id, 'rejected')}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px' }}>
                  {isMember ? (
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} disabled>
                      <UserCheck size={14} color="#10b981" />
                      <span>{isLeader ? 'You are Team Leader' : 'You are in this Team'}</span>
                    </button>
                  ) : isFull ? (
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} disabled>
                      Team Full
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => setSelectedTeamToJoin(team)}
                    >
                      Request to Join Team
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreateOpen && (
        <CreateTeamModal
          opportunities={opportunities}
          onClose={() => setIsCreateOpen(false)}
          onCreated={fetchTeams}
        />
      )}

      {selectedTeamToJoin && (
        <JoinTeamModal
          team={selectedTeamToJoin}
          onClose={() => setSelectedTeamToJoin(null)}
          onSuccess={fetchTeams}
        />
      )}
    </div>
  );
};

export default TeamFormationView;
