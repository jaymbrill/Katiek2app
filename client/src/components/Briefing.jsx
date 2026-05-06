function generateLines(games) {
  const live = games.filter(g => g.status.state === 'in');
  const finished = games.filter(g => g.status.state === 'post');
  const upcoming = games.filter(g => g.status.state === 'pre');
  const lines = [];

  if (live.length) {
    for (const g of live.slice(0, 3)) {
      const lead = g.home.score > g.away.score ? g.home : g.away;
      const trail = lead === g.home ? g.away : g.home;
      const rankStr = r => r ? `#${r} ` : '';
      lines.push(
        `🔴 LIVE — ${rankStr(lead.rank)}${lead.shortName || lead.abbreviation} leads ${rankStr(trail.rank)}${trail.shortName || trail.abbreviation} ${lead.score}–${trail.score} (${g.status.detail || g.status.description})`
      );
    }
  }

  if (finished.length) {
    for (const g of finished.slice(0, 3)) {
      const winner = g.home.winner ? g.home : g.away;
      const loser = winner === g.home ? g.away : g.home;
      if (!winner.name) continue;
      const rW = winner.rank ? `#${winner.rank} ` : '';
      const rL = loser.rank ? `#${loser.rank} ` : '';
      const note = g.note ? ` (${g.note})` : '';
      lines.push(`✅ Final — ${rW}${winner.shortName || winner.abbreviation} def. ${rL}${loser.shortName || loser.abbreviation} ${winner.score}–${loser.score}${note}`);
    }
  }

  if (upcoming.length) {
    for (const g of upcoming.slice(0, 2)) {
      const aRank = g.away.rank ? `#${g.away.rank} ` : '';
      const hRank = g.home.rank ? `#${g.home.rank} ` : '';
      const time = g.date ? new Date(g.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
      const tv = g.broadcast ? ` on ${g.broadcast}` : '';
      lines.push(`🗓 Up next — ${aRank}${g.away.shortName || g.away.abbreviation} at ${hRank}${g.home.shortName || g.home.abbreviation}${time ? ' · ' + time : ''}${tv}`);
    }
  }

  return lines;
}

export default function Briefing({ games, lastUpdated, stale }) {
  const lines = generateLines(games ?? []);
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <section className="briefing-card" aria-label="15-second briefing">
      <div className="briefing-header">
        <span className="briefing-icon">⚡</span>
        <span className="briefing-title">Quick Briefing</span>
        {updatedStr && <span className="briefing-subtitle">Updated {updatedStr}</span>}
      </div>
      <div className="briefing-lines">
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <p key={i} className="briefing-line">{line}</p>
          ))
        ) : (
          <p className="briefing-empty">No games currently scheduled. Check the Schedule tab for what's coming up.</p>
        )}
      </div>
    </section>
  );
}
