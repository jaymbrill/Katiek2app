function TeamLogo({ team, side }) {
  return (
    <div className={`card-team ${side}`}>
      <div className="team-logo-wrap">
        {team.logo ? (
          <img className="team-logo" src={team.logo} alt={team.name} loading="lazy" />
        ) : (
          <div className="team-logo-placeholder">{team.abbreviation}</div>
        )}
        {team.rank && <span className="rank-badge">#{team.rank}</span>}
      </div>
      <span className={`team-name${team.winner ? ' winner-name' : ''}`}>
        {team.shortName || team.abbreviation}
      </span>
      {team.record && <span className="team-record">{team.record}</span>}
    </div>
  );
}

function GameStatus({ status }) {
  if (status.state === 'in') {
    return (
      <div className="card-status live-status">
        <span className="live-dot" aria-hidden="true" />
        {status.period > 0 ? `${ordinal(status.period)} · ${status.clock}` : 'Live'}
      </div>
    );
  }
  if (status.state === 'post') {
    return <div className="card-status">{status.description || 'Final'}</div>;
  }
  return <div className="card-status card-game-date">{formatGameTime(status)}</div>;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatGameTime(status) {
  if (!status.detail && !status.clock) return 'Upcoming';
  return status.detail || status.clock;
}

export default function ScoreCard({ game, isFavorite, onClick }) {
  const { home, away, status, note, broadcast, venue } = game;
  const isLive = status.state === 'in';
  const isPost = status.state === 'post';
  const isPre = status.state === 'pre';

  const homeColor = home.color ? `#${home.color}` : 'var(--primary)';

  return (
    <article
      className={`score-card${isLive ? ' live' : ''}${isFavorite ? ' favorite' : ''}`}
      onClick={() => onClick?.(game)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.(game)}
      aria-label={`${away.name} at ${home.name}${isPost ? ', Final' : ''}`}
    >
      <div className="card-top-bar" style={{ background: homeColor }} aria-hidden="true" />

      {note && <p className="card-note">{note}</p>}

      <div className="card-teams">
        <TeamLogo team={away} side="away" />

        <div className="card-center">
          {isPre ? (
            <>
              <div className="card-game-time">{formatGameDate(game.date)}</div>
              <GameStatus status={status} />
            </>
          ) : (
            <>
              <div className="card-scores">
                <span className={`score-num${away.winner ? ' winner' : ''}`}>
                  {away.score ?? '-'}
                </span>
                <span className="score-sep">–</span>
                <span className={`score-num${home.winner ? ' winner' : ''}`}>
                  {home.score ?? '-'}
                </span>
              </div>
              <GameStatus status={status} />
            </>
          )}
        </div>

        <TeamLogo team={home} side="home" />
      </div>

      <footer className="card-footer">
        {broadcast ? (
          <span className="card-broadcast">{broadcast}</span>
        ) : <span />}
        {venue && <span className="card-venue">{shortVenue(venue)}</span>}
      </footer>
    </article>
  );
}

function formatGameDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function shortVenue(venue) {
  return venue.length > 28 ? venue.slice(0, 26) + '…' : venue;
}
