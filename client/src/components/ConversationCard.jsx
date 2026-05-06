import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';

/* ── Statement generator ───────────────────────────────── */

function teamSide(game, teamId) {
  if (game.home.id === teamId) return { us: game.home, them: game.away, isHome: true };
  return { us: game.away, them: game.home, isHome: false };
}

function rankStr(r) { return r ? `#${r} ` : ''; }

function findStanding(teamId, standings) {
  for (const div of standings?.divisions ?? []) {
    const entry = div.teams?.find(t => t.team.id === teamId);
    if (entry) return entry;
  }
  return null;
}

function findRanking(teamId, rankings) {
  for (const poll of rankings?.polls ?? []) {
    const entry = poll.ranks?.find(r => r.team.id === teamId);
    if (entry) return { ...entry, pollName: poll.shortName ?? poll.name };
  }
  return null;
}

function nextGameSummary(teamId, game) {
  const { them, isHome } = teamSide(game, teamId);
  const when = game.date
    ? new Date(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'soon';
  const tv = game.broadcast ? ` on ${game.broadcast}` : '';
  return `${isHome ? 'hosting' : 'at'} ${rankStr(them.rank)}${them.shortName || them.abbreviation} ${when}${tv}`;
}

function buildStatement(teamId, teamName, games, standings, rankings) {
  const myGames = (games ?? []).filter(g => g.home.id === teamId || g.away.id === teamId);
  const live    = myGames.find(g => g.status.state === 'in');
  const recent  = [...myGames].filter(g => g.status.state === 'post').at(-1);
  const next    = myGames.find(g => g.status.state === 'pre');

  const st   = findStanding(teamId, standings);
  const rank = findRanking(teamId, rankings);

  const record   = st ? `${st.wins}–${st.losses}` : null;
  const confRec  = st ? `${st.confWins}–${st.confLosses} in the B1G` : null;
  const rankBit  = rank ? `, ranked ${rankStr(rank.rank).trim()} in the ${rank.pollName},` : '';
  const recBit   = record ? ` They're ${record}${confRec ? ` (${confRec})` : ''} on the season.` : '';
  const nextBit  = next ? ` Next up: ${nextGameSummary(teamId, next)}.` : '';

  // ── Live ────────────────────────────────────────────────
  if (live) {
    const { us, them } = teamSide(live, teamId);
    const diff = Math.abs(parseInt(us.score ?? 0) - parseInt(them.score ?? 0));
    const usScore = us.score ?? '0';
    const themScore = them.score ?? '0';
    const situation =
      usScore === themScore
        ? `tied ${usScore}–${themScore}`
        : parseInt(usScore) > parseInt(themScore)
          ? `up ${diff}, ${usScore}–${themScore}`
          : `down ${diff}, ${usScore}–${themScore}`;
    const period = live.status.detail ?? live.status.clock ?? '';
    return `They're playing RIGHT NOW — ${situation} against ${rankStr(them.rank)}${them.shortName || them.abbreviation}${period ? ' in the ' + period : ''}.${recBit}`;
  }

  // ── Recent win ───────────────────────────────────────────
  if (recent) {
    const { us, them } = teamSide(recent, recent.home.id === teamId ? 'home' : 'away');
    // re-derive correctly
    const usSide = teamSide(recent, teamId);
    const won = usSide.us.winner;
    const usS  = usSide.us.score ?? '?';
    const thS  = usSide.them.score ?? '?';
    const thRank = rankStr(usSide.them.rank);
    const thName = usSide.them.shortName || usSide.them.abbreviation;
    const noteStr = recent.note ? ` in ${recent.note}` : '';

    if (won) {
      return `${teamName}${rankBit} is looking good — just beat ${thRank}${thName} ${usS}–${thS}${noteStr}.${recBit}${nextBit}`;
    } else {
      return `${teamName}${rankBit} is coming off a tough loss — fell to ${thRank}${thName} ${usS}–${thS}${noteStr}.${recBit}${nextBit}`;
    }
  }

  // ── Only upcoming ────────────────────────────────────────
  if (next) {
    return `${teamName}${rankBit} ${record ? `is ${record} this season` : 'has a game coming up'}. They play ${nextGameSummary(teamId, next)}.`;
  }

  // ── Off-season / no data ─────────────────────────────────
  if (rank) {
    return `${teamName} is ranked ${rankStr(rank.rank).trim()} in the ${rank.pollName}${record ? `, sitting at ${record}` : ''}.`;
  }
  if (record) {
    return `${teamName} is ${record} this season${confRec ? ` (${confRec})` : ''}.`;
  }
  return `${teamName} is in the Big Ten — no recent game data right now, but the season's coming.`;
}

/* ── Component ─────────────────────────────────────────── */

export default function ConversationCard({ sport, favoriteTeamIds, scoresData, teamsList }) {
  const { data: standings } = useApi(() => api.standings(sport), [sport]);
  const { data: rankings  } = useApi(() => api.rankings(sport),  [sport]);

  if (!favoriteTeamIds?.length) return null;

  const teams = favoriteTeamIds.map(id => {
    const meta = teamsList?.find(t => t.id === id);
    const name = meta?.name ?? scoresData?.games
      ?.flatMap(g => [g.home, g.away])
      .find(s => s.id === id)?.name ?? id;
    const color = meta?.color ? `#${meta.color}` : 'var(--primary)';

    const statement = buildStatement(
      id,
      name,
      scoresData?.games ?? [],
      standings,
      rankings
    );

    return { id, name, color, statement };
  });

  return (
    <section aria-label="Conversational briefing per team">
      <div className="section-header">
        <span className="section-title">💬 What to Say</span>
        <span className="section-meta">When someone asks…</span>
      </div>

      {teams.map(team => (
        <div key={team.id} className="convo-card">
          <div className="convo-card-label" style={{ borderLeftColor: team.color }}>
            "How's {team.name} doing?"
          </div>
          <p className="convo-card-body">{team.statement}</p>
        </div>
      ))}
    </section>
  );
}
