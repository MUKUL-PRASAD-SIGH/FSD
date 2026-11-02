import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Background3D from './components/Background3D';
import LandingPage from './views/LandingPage';
import DiscoveryView from './views/DiscoveryView';
import ApplicationTrackerView from './views/ApplicationTrackerView';
import TeamFormationView from './views/TeamFormationView';
import AdminDashboardView from './views/AdminDashboardView';
import AnalyticsView from './views/AnalyticsView';
import AuthModal from './views/AuthModal';
import OpportunityModal from './components/OpportunityModal';
import ApplyModal from './components/ApplyModal';
import AiAssistantDrawer from './components/AiAssistantDrawer';
import AuditLogModal from './components/AuditLogModal';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { Bot, Sparkles } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  // Selected opportunity for detail or application
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [applyingOpportunity, setApplyingOpportunity] = useState(null);

  const { isAuthenticated, isStudent, isAdmin } = useAuth();
  const { showToast } = useToast();

  const handleApplyClick = (opp) => {
    if (!isAuthenticated) {
      showToast('Please sign in or select a demo account to submit an application', 'info');
      setIsAuthOpen(true);
      return;
    }
    if (isAdmin) {
      showToast('Administrators manage opportunities; please sign in as a student to apply.', 'info');
      return;
    }
    setApplyingOpportunity(opp);
  };

  return (
    <div className="app-container">
      {/* 3D Interactive Particle Background — fixed behind all UI */}
      <Background3D />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
      />

      {/* Main Body Content View */}
      <main className="main-content">
        {activeTab === 'home' && (
          <LandingPage
            onNavigate={setActiveTab}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenAi={() => setIsAiOpen(true)}
            onOpenLogs={() => setIsLogsOpen(true)}
          />
        )}

        {activeTab === 'discovery' && (
          <DiscoveryView
            onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
            onApplyOpportunity={handleApplyClick}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            onExploreMore={() => setActiveTab('discovery')}
          />
        )}

        {activeTab === 'teams' && <TeamFormationView />}

        {activeTab === 'admin' && <AdminDashboardView />}

        {activeTab === 'analytics' && <AnalyticsView />}
      </main>

      {/* Floating AI Drawer Trigger Button */}
      {!isAiOpen && (
        <button
          className="ai-drawer-trigger"
          onClick={() => setIsAiOpen(true)}
          title="Open HackElite AI Assistant"
        >
          <Bot size={18} />
          <span>Ask HackElite AI</span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#34d399',
            }}
          />
        </button>
      )}

      {/* Modals & Drawers */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <AuditLogModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />

      <AiAssistantDrawer
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onSelectOpportunity={(opp) => {
          setSelectedOpportunity(opp);
          setIsAiOpen(false);
        }}
      />

      {selectedOpportunity && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          onApply={handleApplyClick}
          userApplied={false}
          isSaved={false}
          onToggleSave={() => {}}
        />
      )}

      {applyingOpportunity && (
        <ApplyModal
          opportunity={applyingOpportunity}
          onClose={() => setApplyingOpportunity(null)}
          onSuccess={() => {
            setActiveTab('tracker');
          }}
        />
      )}
    </div>
  );
}

export default App;
