import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import ScoreCard from './ScoreCard.jsx';

function isFav(game, favIds) {
  if (!favIds?.length) return false;
  return favIds.includes(game.home.id) || favIds.includes(game.away.id);
}

function groupByDate(games) {
  const groups = {};
  for (const g of games) {
    const key = g.date
      ? new Date(g.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'TBD';
    if (!groups[key]) groups[key] = [];
    groups[key].push(g);
  }
  return groups;
}

export default function ScheduleView({ sport, favoriteTeamIds, onGameSelect }) {
  const { data, loading, error, reload } = useApi(() => api.schedule(sport), [sport]);

  const favGames = data?.games?.filter(g => isFav(g, favoriteTeamIds)) ?? [];
  const allGames = data?.games ?? [];
  const groups = groupByDate(allGames);
  const label = sport === 'football' ? 'Football' : 'Basketball';

  if (loading) return <LoadingSpinner label="Loading schedule…" />;

  return (
    <div className="fade-in">
      {error && (
        <div className="error-card">
          ⚠️ {error}
          <br /><button className="error-retry" onClick={reload}>Retry</button>
        </div>
      )}

      {favGames.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Your Teams' Next Games</span>
          </div>
          {favGames.slice(0, 6).map(g => (
            <ScoreCard key={g.id} game={g} isFavorite onClick={onGameSelect} />
          ))}
        </>
      )}

      {allGames.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Full B1G Schedule</span>
            <span className="section-meta">Next 4 weeks</span>
          </div>
          {Object.entries(groups).map(([date, games]) => (
            <div key={date}>
              <div className="section-header" style={{ paddingTop: 12 }}>
                <span className="section-title" style={{ fontSize: 11 }}>{date}</span>
              </div>
              {games.map(g => (
                <ScoreCard key={g.id} game={g} isFavorite={isFav(g, favoriteTeamIds)} onClick={onGameSelect} />
              ))}
            </div>
          ))}
        </>
      )}

      {!error && allGames.length === 0 && (
        <div className="schedule-empty">
          <strong>No upcoming games found</strong>
          Big Ten {label} games will appear here once the schedule is released. Check back closer to the season start.
        </div>
      )}
    </div>
  );
}
