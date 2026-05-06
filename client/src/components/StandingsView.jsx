import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';
import LoadingSpinner from './LoadingSpinner.jsx';

function TeamLogo({ team }) {
  return team.logo
    ? <img className="st-logo" src={team.logo} alt="" loading="lazy" />
    : <div className="st-logo-placeholder">{team.abbreviation}</div>;
}

function StandingsTable({ division, favoriteTeamIds }) {
  const sorted = [...division.teams].sort((a, b) => {
    const confDiff = (b.confWins / (b.confWins + b.confLosses || 1)) - (a.confWins / (a.confWins + a.confLosses || 1));
    if (confDiff !== 0) return confDiff;
    return b.winPct - a.winPct;
  });

  return (
    <div className="standings-division">
      {division.name && division.name !== 'Big Ten' && (
        <div className="standings-div-header">{division.name}</div>
      )}
      <div className="standings-col-headers">
        <span>Team</span>
        <span>Overall</span>
        <span>B1G</span>
        <span>PCT</span>
      </div>
      {sorted.map((entry, i) => {
        const isFav = favoriteTeamIds?.includes(entry.team.id);
        return (
          <div key={entry.team.id ?? i} className={`standings-row${isFav ? ' highlight' : ''}`}>
            <div className="st-team">
              <TeamLogo team={entry.team} />
              <span className="st-name">{entry.team.shortName || entry.team.name}</span>
            </div>
            <span className="st-stat">{entry.wins}–{entry.losses}</span>
            <span className="st-stat conf">{entry.confWins}–{entry.confLosses}</span>
            <span className="st-stat">{entry.winPct > 0 ? entry.winPct.toFixed(3).replace(/^0/, '') : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StandingsView({ sport, favoriteTeamIds }) {
  const { data, loading, error, reload } = useApi(() => api.standings(sport), [sport]);

  if (loading) return <LoadingSpinner label="Loading standings…" />;

  return (
    <div className="fade-in">
      <div className="section-header">
        <span className="section-title">Big Ten Standings</span>
        {data?.lastUpdated && (
          <span className="section-meta">
            {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {error && (
        <div className="error-card">
          ⚠️ {error}
          <br /><button className="error-retry" onClick={reload}>Retry</button>
        </div>
      )}

      {data?.stale && (
        <div className="stale-banner">⚠ Cached standings data</div>
      )}

      <div className="standings-wrap">
        {data?.divisions?.map((div, i) => (
          <StandingsTable key={i} division={div} favoriteTeamIds={favoriteTeamIds} />
        ))}

        {!error && data?.divisions?.length === 0 && (
          <div className="schedule-empty">
            <strong>Standings unavailable</strong>
            Standings are typically available once the season begins.
          </div>
        )}
      </div>

      <div style={{ padding: '8px 16px 4px', fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
        Data provided by ESPN · Subject to official corrections
      </div>
    </div>
  );
}
