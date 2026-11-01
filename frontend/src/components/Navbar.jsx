import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Home,
  Compass,
  FileText,
  Users,
  BarChart3,
  ShieldCheck,
  Bot,
  Terminal,
  LogOut,
  LogIn,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

const Navbar = ({
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenAi,
  onOpenLogs,
}) => {
  const { user, isAuthenticated, isAdmin, isStudent, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <header className="navbar">
      <div className="nav-brand" onClick={() => setActiveTab('home')}>
        <div className="brand-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-title">HackElite AI</span>
          </div>
          <div className="nav-subtitle">
            Opportunity Discovery &amp; Analytics
          </div>
        </div>
      </div>

      <nav className="nav-links">
        <button
          className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home size={16} />
          <span>Home</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          <Compass size={16} />
          <span>Opportunities</span>
        </button>

        {isAuthenticated && isStudent && (
          <button
            className={`nav-tab ${activeTab === 'tracker' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracker')}
          >
            <FileText size={16} />
            <span>My Tracker</span>
          </button>
        )}

        <button
          className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={16} />
          <span>Teams Hub</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          <span>Analytics</span>
        </button>

        {isAuthenticated && isAdmin && (
          <button
            className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <ShieldCheck size={16} />
            <span>Admin Portal</span>
          </button>
        )}
      </nav>

      <div className="nav-actions">
        {/* 🌙☀️ Theme Toggle Button */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          <span className="theme-toggle-track">
            <span className={`theme-toggle-thumb ${isDark ? 'dark' : 'light'}`} />
          </span>
          <span className="theme-toggle-icon">
            {isDark ? (
              <Moon size={14} className="theme-icon moon" />
            ) : (
              <Sun size={14} className="theme-icon sun" />
            )}
          </span>
        </button>

        {/* Audit log button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenLogs}
          title="View live server audit logs"
          style={{ gap: '6px' }}
        >
          <Terminal size={14} color="#38bdf8" />
          <span style={{ fontSize: '0.78rem' }}>Audit Logs</span>
        </button>

        {/* AI Assistant Button */}
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={onOpenAi}
          style={{ gap: '6px' }}
        >
          <Bot size={15} color="#818cf8" />
          <span style={{ fontSize: '0.78rem' }}>AI Advisor</span>
        </button>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="user-pill">
              <div className="user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className={`role-tag ${user.role}`}>
                  {user.role === 'admin' ? '🛡 Admin' : '🎓 Student'}
                </span>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-icon-only"
              onClick={logout}
              title="Logout"
            >
              <LogOut size={16} color="#94a3b8" />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
