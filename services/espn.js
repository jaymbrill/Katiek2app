const cache = new Map();

const CACHE_TTL = {
  live: 30 * 1000,
  default: 5 * 60 * 1000,
  slow: 60 * 60 * 1000,
};

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BigTenSportsApp/1.0)',
  Accept: 'application/json',
};

const SPORTS = {
  football: { sport: 'football', league: 'college-football', group: '5' },
  basketball: { sport: 'basketball', league: 'mens-college-basketball', group: '8' },
};

const BIG_TEN_TEAM_IDS = new Set([
  '356', '84', '2294', '97', '130', '127', '135', '158',
  '77', '194', '213', '2509', '164', '275', '30', '26', '2483', '264',
]);

const BIG_TEN_TEAMS = [
  { id: '356',  name: 'Illinois',       abbr: 'ILL',  color: '#e84a27', altColor: '#13294b' },
  { id: '84',   name: 'Indiana',        abbr: 'IU',   color: '#990000', altColor: '#dfbbbb' },
  { id: '2294', name: 'Iowa',           abbr: 'IOWA', color: '#fcd116', altColor: '#000000' },
  { id: '97',   name: 'Maryland',       abbr: 'UMD',  color: '#e03a3e', altColor: '#ffd520' },
  { id: '130',  name: 'Michigan',       abbr: 'MICH', color: '#00274c', altColor: '#ffcb05' },
  { id: '127',  name: 'Michigan State', abbr: 'MSU',  color: '#18453b', altColor: '#ffffff' },
  { id: '135',  name: 'Minnesota',      abbr: 'MINN', color: '#7a0019', altColor: '#ffcc33' },
  { id: '158',  name: 'Nebraska',       abbr: 'NEB',  color: '#e41c38', altColor: '#ffffff' },
  { id: '77',   name: 'Northwestern',   abbr: 'NW',   color: '#4e2a84', altColor: '#ffffff' },
  { id: '194',  name: 'Ohio State',     abbr: 'OSU',  color: '#bb0000', altColor: '#666666' },
  { id: '213',  name: 'Penn State',     abbr: 'PSU',  color: '#002d62', altColor: '#ffffff' },
  { id: '2509', name: 'Purdue',         abbr: 'PUR',  color: '#8e6f3e', altColor: '#000000' },
  { id: '164',  name: 'Rutgers',        abbr: 'RUT',  color: '#cc0033', altColor: '#5f6a72' },
  { id: '275',  name: 'Wisconsin',      abbr: 'WIS',  color: '#c5050c', altColor: '#f7f7f7' },
  { id: '30',   name: 'USC',            abbr: 'USC',  color: '#990000', altColor: '#ffc72c' },
  { id: '26',   name: 'UCLA',           abbr: 'UCLA', color: '#2d68c4', altColor: '#ffd100' },
  { id: '2483', name: 'Oregon',         abbr: 'ORE',  color: '#154733', altColor: '#FEE123' },
  { id: '264',  name: 'Washington',     abbr: 'UW',   color: '#4b2e83', altColor: '#b7a57a' },
];

async function fetchWithCache(url, ttl) {
  const entry = cache.get(url);
  const now = Date.now();

  if (entry && now - entry.ts < ttl) {
    return { data: entry.data, stale: false, lastUpdated: new Date(entry.ts).toISOString() };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`ESPN API ${res.status}`);
    const data = await res.json();
    cache.set(url, { data, ts: now });
    return { data, stale: false, lastUpdated: new Date().toISOString() };
  } catch (err) {
    if (entry) {
      console.warn(`ESPN fetch failed (${url}): ${err.message} — returning stale data`);
      return { data: entry.data, stale: true, lastUpdated: new Date(entry.ts).toISOString() };
    }
    throw err;
  }
}

function parseCompetitor(c) {
  return {
    id: c?.team?.id ?? null,
    name: c?.team?.displayName ?? '',
    shortName: c?.team?.shortDisplayName ?? c?.team?.displayName ?? '',
    abbreviation: c?.team?.abbreviation ?? '',
    logo: c?.team?.logos?.[0]?.href ?? null,
    color: c?.team?.color ?? null,
    score: c?.score ?? null,
    rank: c?.curatedRank?.current <= 25 ? c.curatedRank.current : null,
    record: c?.records?.[0]?.summary ?? null,
    winner: c?.winner ?? false,
  };
}

function parseGame(event) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  const st = comp?.status;

  return {
    id: event.id,
    name: event.name ?? '',
    date: event.date ?? null,
    status: {
      state: st?.type?.state ?? 'pre',
      description: st?.type?.description ?? '',
      detail: st?.type?.detail ?? st?.displayClock ?? '',
      period: st?.period ?? 0,
      clock: st?.displayClock ?? '',
      completed: st?.type?.completed ?? false,
    },
    home: parseCompetitor(home),
    away: parseCompetitor(away),
    venue: comp?.venue?.fullName ?? null,
    broadcast: comp?.broadcasts?.[0]?.names?.[0] ?? null,
    headline: comp?.headlines?.[0]?.description ?? null,
    note: event.notes?.[0]?.headline ?? null,
  };
}

async function getScores(sport) {
  const cfg = SPORTS[sport];
  if (!cfg) throw new Error(`Unknown sport: ${sport}`);

  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?groups=${cfg.group}&limit=50`;
  const { data: raw, stale, lastUpdated } = await fetchWithCache(url, CACHE_TTL.default);

  const games = (raw.events ?? []).map(parseGame);
  const hasLive = games.some(g => g.status.state === 'in');

  if (hasLive) {
    cache.delete(url);
    const fresh = await fetchWithCache(url, CACHE_TTL.live);
    const freshGames = (fresh.data.events ?? []).map(parseGame);
    return buildScoresPayload(sport, raw, freshGames, false, fresh.lastUpdated);
  }

  return buildScoresPayload(sport, raw, games, stale, lastUpdated);
}

function buildScoresPayload(sport, raw, games, stale, lastUpdated) {
  return {
    sport,
    season: raw.season ?? null,
    week: raw.week ?? null,
    hasLiveGames: games.some(g => g.status.state === 'in'),
    games,
    stale,
    lastUpdated,
  };
}

function parseStandingsEntry(entry, divisionName) {
  const statMap = {};
  for (const s of entry.stats ?? []) statMap[s.name] = s.value;

  return {
    team: {
      id: entry.team?.id ?? null,
      name: entry.team?.displayName ?? '',
      shortName: entry.team?.shortDisplayName ?? entry.team?.displayName ?? '',
      abbreviation: entry.team?.abbreviation ?? '',
      logo: entry.team?.logos?.[0]?.href ?? null,
    },
    division: divisionName,
    wins: statMap.wins ?? statMap.overall?.wins ?? 0,
    losses: statMap.losses ?? statMap.overall?.losses ?? 0,
    confWins: statMap.conferenceWins ?? 0,
    confLosses: statMap.conferenceLosses ?? 0,
    winPct: statMap.winPercent ?? 0,
    streak: entry.stats?.find(s => s.name === 'streak')?.displayValue ?? '',
  };
}

async function getStandings(sport) {
  const cfg = SPORTS[sport];
  if (!cfg) throw new Error(`Unknown sport: ${sport}`);

  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/standings?group=${cfg.group}`;
  const { data: raw, stale, lastUpdated } = await fetchWithCache(url, CACHE_TTL.default);

  const divisions = [];
  for (const child of raw.children ?? []) {
    const entries = (child.standings?.entries ?? []).map(e => parseStandingsEntry(e, child.name));
    if (entries.length) {
      divisions.push({ name: child.name ?? 'Conference', teams: entries });
    }
  }

  if (!divisions.length && raw.standings?.entries?.length) {
    const entries = raw.standings.entries.map(e => parseStandingsEntry(e, 'Big Ten'));
    divisions.push({ name: 'Big Ten', teams: entries });
  }

  return { sport, divisions, stale, lastUpdated };
}

async function getRankings(sport) {
  const cfg = SPORTS[sport];
  if (!cfg) throw new Error(`Unknown sport: ${sport}`);

  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/rankings`;
  const { data: raw, stale, lastUpdated } = await fetchWithCache(url, CACHE_TTL.slow);

  const polls = (raw.rankings ?? []).map(poll => ({
    name: poll.name ?? '',
    shortName: poll.shortName ?? poll.name ?? '',
    date: poll.date ?? null,
    ranks: (poll.ranks ?? []).map(r => {
      const prev = r.previous ?? 0;
      const curr = r.current ?? 0;
      return {
        rank: curr,
        previousRank: prev,
        change: prev > 0 ? prev - curr : null,
        isNew: prev === 0,
        team: {
          id: r.team?.id ?? null,
          name: r.team?.displayName ?? '',
          shortName: r.team?.shortDisplayName ?? r.team?.displayName ?? '',
          abbreviation: r.team?.abbreviation ?? '',
          logo: r.team?.logos?.[0]?.href ?? null,
        },
        record: r.recordSummary ?? '',
        points: r.points ?? 0,
        isBigTen: BIG_TEN_TEAM_IDS.has(r.team?.id),
      };
    }),
  }));

  return { sport, polls, stale, lastUpdated };
}

async function getSchedule(sport, weeksAhead = 4) {
  const cfg = SPORTS[sport];
  if (!cfg) throw new Error(`Unknown sport: ${sport}`);

  const today = new Date();
  const upcomingGames = [];

  for (let w = 0; w <= weeksAhead; w++) {
    const d = new Date(today);
    d.setDate(d.getDate() + w * 7);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?groups=${cfg.group}&dates=${dateStr}&limit=50`;
    try {
      const { data: raw } = await fetchWithCache(url, CACHE_TTL.slow);
      for (const event of raw.events ?? []) {
        const game = parseGame(event);
        if (game.status.state === 'pre') upcomingGames.push(game);
      }
    } catch {
      // skip failed week
    }
  }

  const seen = new Set();
  const unique = upcomingGames.filter(g => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
  unique.sort((a, b) => new Date(a.date) - new Date(b.date));

  return { sport, games: unique, lastUpdated: new Date().toISOString() };
}

module.exports = { getScores, getStandings, getRankings, getSchedule, BIG_TEN_TEAMS };
