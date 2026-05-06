import { useEffect } from 'react';

function SheetLogo({ team }) {
  return team.logo
    ? <img className="sheet-logo" src={team.logo} alt={team.name} />
    : <div className="team-logo-placeholder" style={{ width: 56, height: 56, fontSize: 13 }}>{team.abbreviation}</div>;
}

export default function GameDetail({ game, onClose }) {
  const { home, away, status, broadcast, venue, headline, note } = game;
  const isLive = status.state === 'in';
  const isPost = status.state === 'post';

  useEffect(() => {
    const handler = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="sheet-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Game details">
      <div className="sheet slide-up" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />

        {note && <p className="sheet-title">{note}</p>}

        <div className="sheet-scoreboard">
          <div className="sheet-team">
            <SheetLogo team={away} />
            {away.rank && <span className="rank-badge" style={{ position: 'static', display: 'inline-block', marginTop: 4 }}>#{away.rank}</span>}
            <div className="sheet-team-name">{away.name}</div>
            {away.record && <div className="team-record">{away.record}</div>}
          </div>

          {(isPost || isLive) ? (
            <>
              <span className={`sheet-score${away.winner ? ' winner' : ''}`}>{away.score ?? '-'}</span>
              <span className="sheet-vs">–</span>
              <span className={`sheet-score${home.winner ? ' winner' : ''}`}>{home.score ?? '-'}</span>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-2)' }}>vs</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                {formatDateTime(game.date)}
              </div>
            </div>
          )}

          <div className="sheet-team">
            <SheetLogo team={home} />
            {home.rank && <span className="rank-badge" style={{ position: 'static', display: 'inline-block', marginTop: 4 }}>#{home.rank}</span>}
            <div className="sheet-team-name">{home.name}</div>
            {home.record && <div className="team-record">{home.record}</div>}
          </div>
        </div>

        <div className={`sheet-status${isLive ? ' live' : ''}`}>
          {isLive && <span className="live-dot" />}
          {status.detail || status.description || 'Final'}
        </div>

        <div className="sheet-meta">
          {broadcast && (
            <div className="sheet-meta-row">
              <span className="sheet-meta-icon">📺</span>
              <span>{broadcast}</span>
            </div>
          )}
          {venue && (
            <div className="sheet-meta-row">
              <span className="sheet-meta-icon">🏟️</span>
              <span>{venue}</span>
            </div>
          )}
          {game.date && (
            <div className="sheet-meta-row">
              <span className="sheet-meta-icon">🕐</span>
              <span>{formatDateTime(game.date)}</span>
            </div>
          )}
        </div>

        {headline && <div className="sheet-headline">{headline}</div>}

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}
