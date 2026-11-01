import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Compass,
  Bot,
  Users,
  FileText,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Award,
  Calendar,
  Building,
  Terminal,
  ExternalLink,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LandingPage = ({
  onNavigate,
  onOpenAuth,
  onOpenAi,
  onOpenLogs,
}) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="landing-page">
      {/* 1. HERO SECTION */}
      <section className="landing-hero">
        <div>
          <div className="hero-pill-badge">
            <span className="pulse-dot"></span>
            <span>AI-powered opportunity discovery for students</span>
          </div>

          <h1 className="hero-heading">
            Discover Hackathons, Internships & Tech Opportunities{' '}
            <span className="gradient-text-hero">Powered by AI</span>
          </h1>

          <p className="hero-subheading">
            Stop searching through scattered Discord channels and outdated job boards.
            <strong> HackElite AI</strong> aggregates verified global hackathons, high-stipend
            internships, coding contests, and research grants—with intelligent skill matching,
            collaborative team formation, and real-time application tracking.
          </p>

          <div className="hero-cta-group">
            <button
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.98rem' }}
              onClick={() => onNavigate('discovery')}
            >
              <Compass size={18} />
              <span>Explore Opportunities</span>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '12px 20px', fontSize: '0.98rem' }}
              onClick={onOpenAi}
            >
              <Bot size={18} color="#818cf8" />
              <span>Ask AI Advisor</span>
            </button>

            {!isAuthenticated && (
              <button
                className="btn btn-outline-primary"
                style={{ padding: '12px 20px', fontSize: '0.92rem' }}
                onClick={onOpenAuth}
              >
                <span>Try a Demo Account</span>
              </button>
            )}
          </div>

          <div className="hero-trust-metrics">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span><strong>100%</strong> Verified Listings</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="#f59e0b" />
              <span><strong>Live</strong> Opportunity Data</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={16} color="#38bdf8" />
              <span><strong>Full</strong> Audit Logging</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Glass Mockup */}
        <div className="hero-mockup-wrapper">
          {/* Floating Pill: Left */}
          <div className="floating-pill-left">
            <Award size={15} color="#34d399" />
            <span>94% Application Success Rate</span>
          </div>

          {/* Floating Pill: Right */}
          <div className="floating-pill-right">
            <Bot size={15} color="#38bdf8" />
            <span>AI Contextual Match: 98%</span>
          </div>

          {/* Featured Frosted Card */}
          <div className="hero-glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="badge badge-domain">AI/ML</span>
                <span className="badge badge-type">Hackathon</span>
                <span className="badge badge-status-active">Remote</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                ★ Featured
              </span>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
              Global Generative AI Hackathon 2026
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '14px' }}>
              <Building size={14} />
              <span>Anthropic Labs & Google Cloud</span>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '16px' }}>
              Build cutting-edge multi-agent AI systems and multimodal applications solving sustainable development goals.
            </p>

            <div className="card-meta-list" style={{ marginBottom: '16px' }}>
              <div className="meta-item">
                <Award size={14} color="#f59e0b" />
                <span>Prize: <strong>$50,000 Cash Pool + Cloud Credits</strong></span>
              </div>
              <div className="meta-item">
                <Calendar size={14} color="#06b6d4" />
                <span>Deadline: <strong>14 Days Left</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
              {['Python', 'LLMs', 'React', 'Vector DB'].map((skill) => (
                <span key={skill} className="skill-pill">
                  {skill}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => onNavigate('discovery')}
              >
                Apply with 1-Click
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAi}
              >
                <Bot size={14} />
                <span>AI Insights</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATS & SOCIAL PROOF BANNER */}
      <section className="stats-banner">
        <div className="stat-item">
          <div className="stat-number">500+</div>
          <div className="stat-label">Verified Tech Opportunities</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">1,200+</div>
          <div className="stat-label">Enrolled Student Engineers</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">$250K+</div>
          <div className="stat-label">Prize Pools & Stipends</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">94%</div>
          <div className="stat-label">Candidate Match Accuracy</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">100%</div>
          <div className="stat-label">Requests Audit-Logged</div>
        </div>
      </section>

      {/* 3. THE PROBLEM VS. THE SOLUTION */}
      <section>
        <div className="section-header">
          <span className="section-tag">
            <Zap size={14} /> Why HackElite AI?
          </span>
          <h2 className="section-title">The Challenge of Fragmented Technical Opportunities</h2>
          <p className="section-description">
            University students miss out on career-defining hackathons and internships due to
            disconnected channels, silent rejections, and chaotic team discovery.
          </p>
        </div>

        <div className="problem-solution-grid">
          {/* Problem Card */}
          <div className="comparison-card problem">
            <div className="comparison-header">
              <div className="comparison-icon-box" style={{ background: 'rgba(244, 63, 94, 0.15)' }}>
                <XCircle size={24} color="#f43f5e" />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>The Traditional Way</h3>
                <span style={{ color: '#fb7185', fontSize: '0.8rem', fontWeight: 600 }}>Fragmented & Inefficient</span>
              </div>
            </div>

            <div className="comparison-list">
              <div className="comparison-item">
                <XCircle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Scattered Channels</strong>: Opportunities are buried across disparate Discord servers, WhatsApp groups, and generic job boards.
                </span>
              </div>
              <div className="comparison-item">
                <XCircle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Zero Application Visibility</strong>: "Resume black holes" where applicants have no insight into review status or timeline stages.
                </span>
              </div>
              <div className="comparison-item">
                <XCircle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Chaotic Team Formation</strong>: Cold direct messages looking for teammates without verified skills or portfolio synergy.
                </span>
              </div>
              <div className="comparison-item">
                <XCircle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Lack of Contextual Guidance</strong>: No tailored advice on elevator pitches, eligibility, or technical stacks.
                </span>
              </div>
            </div>
          </div>

          {/* Solution Card */}
          <div className="comparison-card solution">
            <div className="comparison-header">
              <div className="comparison-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>The HackElite AI Platform</h3>
                <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>Intelligent, Unified & Audited</span>
              </div>
            </div>

            <div className="comparison-list">
              <div className="comparison-item">
                <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Centralized Technical Discovery</strong>: Curated listings categorized by domain, modality, rewards, and deadlines.
                </span>
              </div>
              <div className="comparison-item">
                <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>4-Stage Application Tracker</strong>: Live visual progress stepper from submission to committee decision with feedback notes.
                </span>
              </div>
              <div className="comparison-item">
                <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>Collaborative Teams Hub</strong>: Recruit peers by missing skill sets and attach concept pitch decks.
                </span>
              </div>
              <div className="comparison-item">
                <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#cbd5e1' }}>
                  <strong>AI Contextual Grounding</strong>: Conversational assistant directly matching database opportunities to your profile.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CORE PLATFORM MODULES */}
      <section>
        <div className="section-header">
          <span className="section-tag">
            <Sparkles size={14} /> Comprehensive Features
          </span>
          <h2 className="section-title">Everything You Need in One Platform</h2>
          <p className="section-description">
            Discover, apply, collaborate and track progress with secure role-based access
            and complete request-level audit logging.
          </p>
        </div>

        <div className="features-grid">
          {/* Module 1: Smart Search & Filters */}
          <div className="feature-card" onClick={() => onNavigate('discovery')} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <Compass size={24} color="#818cf8" />
            </div>
            <span className="feature-tag-pill">Module 2 & 3 • Search & Discovery</span>
            <h3 className="feature-card-title">Multi-Attribute Search & Filter</h3>
            <p className="feature-card-desc">
              Filter by technical domain (AI/ML, Web Dev, Cloud, Cybersecurity, Blockchain), work modality (Remote, Hybrid, On-site), and sort by impending deadlines.
            </p>
          </div>

          {/* Module 2: AI Contextual Assistant */}
          <div className="feature-card" onClick={onOpenAi} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
              <Bot size={24} color="#22d3ee" />
            </div>
            <span className="feature-tag-pill">Module 6 • AI Advisor</span>
            <h3 className="feature-card-title">Contextual AI Opportunity Advisor</h3>
            <p className="feature-card-desc">
              Interact with a conversational AI engine grounded directly in live MongoDB listings. Ask for personalized matches, deadline warnings, and application pitch advice.
            </p>
          </div>

          {/* Module 3: Application Tracker */}
          <div className="feature-card" onClick={() => onNavigate('tracker')} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
              <FileText size={24} color="#34d399" />
            </div>
            <span className="feature-tag-pill">Module 3 • Application Tracker</span>
            <h3 className="feature-card-title">4-Stage Application Lifecycle</h3>
            <p className="feature-card-desc">
              Track submissions with an intuitive stepper: Applied → Under Review → Shortlisted → Accepted. View reviewer feedback and manage withdrawals.
            </p>
          </div>

          {/* Module 4: Team Formation */}
          <div className="feature-card" onClick={() => onNavigate('teams')} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
              <Users size={24} color="#fbbf24" />
            </div>
            <span className="feature-tag-pill">Module 4 • Collaborative Teams</span>
            <h3 className="feature-card-title">Team Formation & File Upload</h3>
            <p className="feature-card-desc">
              Form multi-disciplinary teams for hackathons, specify required teammate skills, upload project pitch decks, and process join requests.
            </p>
          </div>

          {/* Module 5: Real-time Analytics Dashboard */}
          <div className="feature-card" onClick={() => onNavigate('analytics')} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
              <BarChart3 size={24} color="#c084fc" />
            </div>
            <span className="feature-tag-pill">Module 5 • Ecosystem Analytics</span>
            <h3 className="feature-card-title">Aggregated Analytics & KPIs</h3>
            <p className="feature-card-desc">
              Inspect live domain demand, application funnel conversion, and top hiring organizers computed directly via MongoDB aggregation pipelines.
            </p>
          </div>

          {/* Module 6: Request-Response Audit Inspector */}
          <div className="feature-card" onClick={onOpenLogs} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.15)' }}>
              <Terminal size={24} color="#38bdf8" />
            </div>
            <span className="feature-tag-pill">Transparency • Audit Trail</span>
            <h3 className="feature-card-title">Server Audit Log Inspector</h3>
            <p className="feature-card-desc">
              Inspect live server activity, including routes, authenticated user, response time and status codes.
            </p>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS 3-STEP PIPELINE */}
      <section>
        <div className="section-header">
          <span className="section-tag">
            <Zap size={14} /> Seamless Workflow
          </span>
          <h2 className="section-title">How HackElite AI Accelerates Your Journey</h2>
          <p className="section-description">
            From discovering verified opportunities to forming winning teams and getting shortlisted.
          </p>
        </div>

        <div className="steps-pipeline-grid">
          <div className="step-card">
            <span className="step-num-badge">01</span>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>Discover & AI Match</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Search across curated listings or ask the HackElite AI Assistant to analyze your skills and suggest matching hackathons and internships.
            </p>
          </div>

          <div className="step-card">
            <span className="step-num-badge">02</span>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>Collaborate & Apply</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Form a collaborative team on the Teams Hub, upload your pitch document, or apply individually with your uploaded resume and statement.
            </p>
          </div>

          <div className="step-card">
            <span className="step-num-badge">03</span>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>Track & Succeed</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Monitor your application status on the live Kanban stepper, read reviewer notes, and receive decisions with complete transparency.
            </p>
          </div>
        </div>
      </section>

      {/* 6. DUAL PERSPECTIVE: STUDENTS VS ADMINISTRATORS */}
      <section>
        <div className="section-header">
          <span className="section-tag">
            <ShieldCheck size={14} /> Role Separation (RBAC)
          </span>
          <h2 className="section-title">Tailored Portals for Students & Administrators</h2>
          <p className="section-description">
            Distinct permission sets and dashboards powered by secure JWT authentication.
          </p>
        </div>

        <div className="problem-solution-grid">
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                🎓
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>For Engineering Students</h3>
                <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>Active Discovery & Career Growth</span>
              </div>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', color: '#cbd5e1', fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" /> Single dashboard for hackathons, internships, and grants
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" /> AI Advisor recommending matches based on your GitHub & skills
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" /> Real-time application tracker with feedback notes
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" /> Hackathon team recruitment hub with pitch attachments
              </li>
            </ul>
          </div>

          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                🛡
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>For Administrators & Faculty</h3>
                <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>Curation & Evaluation Management</span>
              </div>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', color: '#cbd5e1', fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#f59e0b" /> Full CRUD management to publish, edit, or remove listings
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#f59e0b" /> Applicant review dossier to examine uploaded student resumes
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#f59e0b" /> Multi-stage decision updates (Shortlist, Accept, Reject)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#f59e0b" /> College-wide participation analytics and domain breakdown
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. HIGH-CONVERTING CTA BANNER */}
      <section className="landing-cta-banner">
        <div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#fff', marginBottom: '10px', letterSpacing: '-0.5px' }}>
            Ready to Launch Your Technical Career?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.02rem', maxWidth: '580px', lineHeight: '1.6' }}>
            Join hundreds of university developers discovering elite opportunities, forming winning teams, and getting selected with HackElite AI.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', zIndex: 2 }}>
          <button
            className="btn btn-primary"
            style={{ padding: '14px 26px', fontSize: '1rem' }}
            onClick={() => onNavigate('discovery')}
          >
            <Compass size={18} />
            <span>Start Exploring Now</span>
            <ArrowRight size={16} />
          </button>

          {!isAuthenticated && (
            <button
              className="btn btn-secondary"
              style={{ padding: '14px 22px', fontSize: '1rem' }}
              onClick={onOpenAuth}
            >
              <span>Try a Demo Account</span>
            </button>
          )}
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-icon" style={{ width: '34px', height: '34px' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <span className="brand-title" style={{ fontSize: '1.15rem' }}>HackElite AI</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}
              onClick={() => onNavigate('discovery')}
            >
              Opportunities
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}
              onClick={() => onNavigate('teams')}
            >
              Teams Hub
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}
              onClick={() => onNavigate('analytics')}
            >
              Analytics
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}
              onClick={onOpenLogs}
            >
              Audit Logs
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © HackElite AI. Built with React, Express, MongoDB and Node.js.
          </span>
          <span>
            Technical opportunities, in one place.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
