import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import ScoreCard from './ScoreCard.jsx';
import Briefing from './Briefing.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function isFav(game, favIds) {
  if (!favIds?.length) return false;
  return favIds.includes(game.home.id) || favIds.includes(game.away.id);
}

export default function Dashboard({ sport, favoriteTeamIds, onGameSelect }) {
  const { data, loading, error, reload } = useApi(
    () => api.scores(sport),
    [sport]
  );

  const favGames = data?.games?.filter(g => isFav(g, favoriteTeamIds)) ?? [];
  const otherGames = data?.games?.filter(g => !isFav(g, favoriteTeamIds)) ?? [];

  const label = sport === 'football' ? '🏈 Football' : '🏀 Basketball';

  if (loading) return <LoadingSpinner label={`Loading ${label}…`} />;

  return (
    <div className="fade-in">
      <h1 className="dash-greeting">
        {greeting()}, <em>B1G</em> fan
      </h1>

      {error && (
        <div className="error-card">
          ⚠️ {error}
          <br />
          <button className="error-retry" onClick={reload}>Retry</button>
        </div>
      )}

      {data?.stale && (
        <div className="stale-banner">
          ⚠ Showing cached data from {new Date(data.lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      )}

      {data && <Briefing games={data.games} lastUpdated={data.lastUpdated} stale={data.stale} />}

      {favGames.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Your Teams</span>
            {data?.week?.number && <span className="section-meta">Week {data.week.number}</span>}
          </div>
          {favGames.map(game => (
            <ScoreCard
              key={game.id}
              game={game}
              isFavorite
              onClick={onGameSelect}
            />
          ))}
        </>
      )}

      {otherGames.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">
              {favGames.length > 0 ? 'Other B1G Games' : 'Big Ten ' + (sport === 'football' ? 'Football' : 'Basketball')}
            </span>
            {!favGames.length && data?.hasLiveGames && (
              <span className="section-meta" style={{ color: 'var(--live-red)' }}>● Live</span>
            )}
          </div>
          {otherGames.map(game => (
            <ScoreCard key={game.id} game={game} onClick={onGameSelect} />
          ))}
        </>
      )}

      {!loading && !error && data?.games?.length === 0 && (
        <div className="schedule-empty">
          <strong>No games today</strong>
          Check the Schedule tab to see what's coming up for Big Ten {sport}.
        </div>
      )}
    </div>
  );
}
