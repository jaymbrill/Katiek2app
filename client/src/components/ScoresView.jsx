import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import ScoreCard from './ScoreCard.jsx';

function isFav(game, favIds) {
  if (!favIds?.length) return false;
  return favIds.includes(game.home.id) || favIds.includes(game.away.id);
}

export default function ScoresView({ sport, favoriteTeamIds, onGameSelect }) {
  const { data, loading, error, reload } = useApi(() => api.scores(sport), [sport]);

  const live = data?.games?.filter(g => g.status.state === 'in') ?? [];
  const final = data?.games?.filter(g => g.status.state === 'post') ?? [];
  const pre = data?.games?.filter(g => g.status.state === 'pre') ?? [];

  if (loading) return <LoadingSpinner label="Loading scores…" />;

  return (
    <div className="fade-in">
      {error && (
        <div className="error-card">
          ⚠️ {error}
          <br />
          <button className="error-retry" onClick={reload}>Retry</button>
        </div>
      )}

      {data?.stale && (
        <div className="stale-banner">
          ⚠ Cached data · Last updated {new Date(data.lastUpdated).toLocaleTimeString()}
        </div>
      )}

      {live.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Live Now</span>
            <span className="section-meta" style={{ color: 'var(--live-red)' }}>● {live.length} game{live.length > 1 ? 's' : ''}</span>
          </div>
          {live.map(g => <ScoreCard key={g.id} game={g} isFavorite={isFav(g, favoriteTeamIds)} onClick={onGameSelect} />)}
        </>
      )}

      {final.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Final</span>
          </div>
          {final.map(g => <ScoreCard key={g.id} game={g} isFavorite={isFav(g, favoriteTeamIds)} onClick={onGameSelect} />)}
        </>
      )}

      {pre.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Upcoming Today</span>
          </div>
          {pre.map(g => <ScoreCard key={g.id} game={g} isFavorite={isFav(g, favoriteTeamIds)} onClick={onGameSelect} />)}
        </>
      )}

      {!error && data?.games?.length === 0 && (
        <div className="schedule-empty">
          <strong>No games scheduled today</strong>
          Check the Schedule tab for upcoming Big Ten games.
        </div>
      )}
    </div>
  );
}
