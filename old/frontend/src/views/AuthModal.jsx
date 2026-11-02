import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, GraduationCap, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [college, setCollege] = useState('');
  const [skills, setSkills] = useState('');
  const [bio, setBio] = useState('');

  const { login, register, loading } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      const res = await login(email, password);
      if (res.success) onClose();
    } else {
      const res = await register({
        name,
        email,
        password,
        role,
        college,
        skills,
        bio,
      });
      if (res.success) onClose();
    }
  };

  const handleQuickLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    const res = await login(demoEmail, demoPassword);
    if (res.success) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isLogin ? 'Welcome Back' : 'Create Your Account'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
              Access your HackElite AI account
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Quick demo access */}
        <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
            Quick access with a demo account
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start', padding: '6px 10px', gap: '6px' }}
              onClick={() => handleQuickLogin('admin@hackelite.ai', 'AdminPassword123')}
            >
              <Shield size={14} color="#f59e0b" />
              <span>Login as Admin</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', justifyContent: 'flex-start', padding: '6px 10px', gap: '6px' }}
              onClick={() => handleQuickLogin('alex@student.edu', 'StudentPassword123')}
            >
              <GraduationCap size={14} color="#10b981" />
              <span>Login as Student</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ paddingTop: '16px' }}>
            {/* Toggle Login / Register */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px', marginBottom: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${isLogin ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setIsLogin(true)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`btn btn-sm ${!isLogin ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setIsLogin(false)}
              >
                Create Account
              </button>
            </div>

            {!isLogin && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Maya Lin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Role *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: role === 'student' ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${role === 'student' ? '#10b981' : 'var(--border-color)'}`,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="student"
                        checked={role === 'student'}
                        onChange={() => setRole('student')}
                      />
                      <span>Student</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${role === 'admin' ? '#f59e0b' : 'var(--border-color)'}`,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                      />
                      <span>Administrator</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">College / University Department</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dept of Computer Science & Eng"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Technical Skills (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="React, Node.js, Python, Docker"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                required
                minLength={6}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
