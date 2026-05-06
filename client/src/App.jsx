import { useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import SportToggle from './components/SportToggle.jsx';
import Dashboard from './components/Dashboard.jsx';
import ScoresView from './components/ScoresView.jsx';
import StandingsView from './components/StandingsView.jsx';
import RankingsView from './components/RankingsView.jsx';
import ScheduleView from './components/ScheduleView.jsx';
import TeamSelector from './components/TeamSelector.jsx';
import GameDetail from './components/GameDetail.jsx';
import { usePreferences } from './hooks/usePreferences.js';

const TABS = ['home', 'scores', 'standings', 'rankings', 'schedule'];

export default function App() {
  const { prefs, setFavoriteTeams, setSport } = usePreferences();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedGame, setSelectedGame] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(!prefs.onboarded);

  function handleOnboardingDone(teams) {
    setFavoriteTeams(teams);
    setShowOnboarding(false);
  }

  const sport = prefs.sport ?? 'football';

  return (
    <div className="app">
      {showOnboarding && (
        <TeamSelector onDone={handleOnboardingDone} />
      )}

      <header className="header">
        <div className="header-logo">
          <span>B1G</span> Sports
        </div>
        <SportToggle sport={sport} onChange={setSport} />
      </header>

      <main className="scroll-area fade-in" key={activeTab + sport}>
        {activeTab === 'home' && (
          <Dashboard sport={sport} favoriteTeamIds={prefs.favoriteTeams} onGameSelect={setSelectedGame} />
        )}
        {activeTab === 'scores' && (
          <ScoresView sport={sport} favoriteTeamIds={prefs.favoriteTeams} onGameSelect={setSelectedGame} />
        )}
        {activeTab === 'standings' && (
          <StandingsView sport={sport} favoriteTeamIds={prefs.favoriteTeams} />
        )}
        {activeTab === 'rankings' && (
          <RankingsView sport={sport} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleView sport={sport} favoriteTeamIds={prefs.favoriteTeams} onGameSelect={setSelectedGame} />
        )}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {selectedGame && (
        <GameDetail game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}
