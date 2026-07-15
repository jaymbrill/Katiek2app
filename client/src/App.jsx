import { useState, useEffect } from 'react';
import TrainingDashboard from './components/TrainingDashboard.jsx';
import TrainingPlan from './components/TrainingPlan.jsx';
import PreferencesView from './components/PreferencesView.jsx';
import StravaConnect from './components/StravaConnect.jsx';
import { api } from './api/client.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z|M9 21V12h6v9' },
  { id: 'plan', label: 'Plan', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { id: 'settings', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z|M12 15a3 3 0 110-6 3 3 0 010 6z' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava') === 'connected') {
      window.history.replaceState({}, '', '/');
      api.status().then(setStatus);
    }
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading R2R2R Training...</p>
        </div>
      </div>
    );
  }

  const connected = status?.connected;

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <span>R2R2R</span> Training
        </div>
        {status && (
          <div className="header-countdown">
            {status.daysUntilRace} days
          </div>
        )}
      </header>

      <main className="scroll-area fade-in" key={activeTab}>
        {!connected && activeTab !== 'settings' ? (
          <StravaConnect onConnected={() => api.status().then(setStatus)} />
        ) : (
          <>
            {activeTab === 'dashboard' && <TrainingDashboard />}
            {activeTab === 'plan' && <TrainingPlan />}
            {activeTab === 'settings' && <PreferencesView status={status} onReconnect={() => api.status().then(setStatus)} />}
          </>
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {tab.icon.split('|').map((d, i) => <path key={i} d={d} />)}
            </svg>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
