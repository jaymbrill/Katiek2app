import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';
import LoadingSpinner from './LoadingSpinner.jsx';

function ChangeIndicator({ rank }) {
  if (rank.isNew) return <span className="rank-change new">NEW</span>;
  if (rank.change === null) return <span className="rank-change same">—</span>;
  if (rank.change > 0) return <span className="rank-change up">▲{rank.change}</span>;
  if (rank.change < 0) return <span className="rank-change down">▼{Math.abs(rank.change)}</span>;
  return <span className="rank-change same">—</span>;
}

function PollCard({ poll }) {
  if (!poll.ranks?.length) return null;

  const dateStr = poll.date
    ? new Date(poll.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="poll-card">
      <div className="poll-header">
        <span className="poll-name">{poll.name}</span>
        {dateStr && <span className="poll-date">{dateStr}</span>}
      </div>
      {poll.ranks.map((rank, i) => (
        <div
          key={rank.team.id ?? i}
          className={`rank-row${rank.isBigTen ? ' big-ten' : ''}`}
        >
          <span className={`rank-num${rank.rank <= 3 ? ' top3' : ''}`}>
            {rank.rank}
          </span>
          <div className="rank-team">
            {rank.team.logo
              ? <img className="rank-logo" src={rank.team.logo} alt="" loading="lazy" />
              : <div className="rank-logo-placeholder">{rank.team.abbreviation}</div>
            }
            <div>
              <div className="rank-name">{rank.team.shortName || rank.team.name}</div>
              <div className="rank-record">{rank.record}</div>
            </div>
            {rank.isBigTen && <span className="b1g-badge">B1G</span>}
          </div>
          <span className="st-stat" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {rank.points > 0 ? rank.points.toLocaleString() : ''}
          </span>
          <ChangeIndicator rank={rank} />
        </div>
      ))}
    </div>
  );
}

export default function RankingsView({ sport }) {
  const { data, loading, error, reload } = useApi(() => api.rankings(sport), [sport]);

  if (loading) return <LoadingSpinner label="Loading rankings…" />;

  const hasBigTen = data?.polls?.some(p => p.ranks?.some(r => r.isBigTen));
  const label = sport === 'football' ? 'Football' : 'Basketball';

  return (
    <div className="fade-in">
      <div className="section-header">
        <span className="section-title">National Rankings</span>
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
        <div className="stale-banner">⚠ Cached ranking data</div>
      )}

      {hasBigTen && (
        <div className="stale-banner" style={{ background: 'var(--primary-dim)', borderColor: 'rgba(59,130,246,0.3)', color: 'var(--primary)' }}>
          <span>■</span> Big Ten teams highlighted
        </div>
      )}

      <div className="rankings-wrap">
        {data?.polls?.map((poll, i) => (
          <PollCard key={i} poll={poll} />
        ))}

        {!error && !data?.polls?.length && (
          <div className="schedule-empty">
            <strong>No rankings available</strong>
            {label} rankings are published weekly during the season.
          </div>
        )}
      </div>

      <div style={{ padding: '8px 16px 4px', fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
        AP Poll & Coaches Poll via ESPN · All 25 ranked teams shown; B1G teams highlighted
      </div>
    </div>
  );
}
