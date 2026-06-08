'use strict';

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

// ── DB ─────────────────────────────────────────────────────────────────────

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS athletes (
      id            TEXT PRIMARY KEY,
      firstname     TEXT NOT NULL,
      lastname      TEXT NOT NULL,
      profile       TEXT NOT NULL DEFAULT '',
      access_token  TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at    BIGINT NOT NULL,
      analysis      JSONB,
      last_synced_at BIGINT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Strava helpers ─────────────────────────────────────────────────────────

async function refreshToken(refreshToken) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function getValidToken(row) {
  if (Date.now() / 1000 < row.expires_at - 300) {
    return { access_token: row.access_token, refresh_token: row.refresh_token, expires_at: row.expires_at };
  }
  return refreshToken(row.refresh_token);
}

async function fetchActivities(accessToken) {
  const after = Math.floor((Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) / 1000);
  const all = [];
  for (let page = 1; page <= 40; page++) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Fetch activities failed: ${await res.text()}`);
    const batch = await res.json();
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

// ── Analysis (mirrors stravaAnalysis.ts) ───────────────────────────────────

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function topTypes(activities) {
  const counts = {};
  for (const a of activities) counts[a.sport_type] = (counts[a.sport_type] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
}

function analyzeActivities(activities) {
  const M_TO_FT = 3.281;
  const MIN_ELEVATION_M = 305;
  const MIN_MOVING_TIME_S = 600;
  const ELITE_FT_HR = 2460;
  const STRONG_FT_HR = 1804;
  const INTERMEDIATE_FT_HR = 1148;

  const total = activities.length;
  const qualifying = activities.filter(
    (a) => a.total_elevation_gain >= MIN_ELEVATION_M && a.moving_time >= MIN_MOVING_TIME_S
  );

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedFtPerHr: 0,
      weeklyClimbingFt: 0,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
    };
  }

  const vertSpeeds = qualifying.map((a) => (a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600));
  const medVert = median(vertSpeeds);
  const totalGainFt = qualifying.reduce((s, a) => s + a.total_elevation_gain * M_TO_FT, 0);
  const weeklyGainFt = totalGainFt / 104;

  let suggestedLevel, reasoning;
  if (medVert >= ELITE_FT_HR || weeklyGainFt >= 1970) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${Math.round(medVert).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVert >= STRONG_FT_HR || weeklyGainFt >= 1148) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${Math.round(medVert).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVert >= INTERMEDIATE_FT_HR || weeklyGainFt >= 492) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${Math.round(medVert).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${Math.round(medVert).toLocaleString()} ft/hr median vertical speed. More elevation training recommended.`;
  }

  const confidence = qualifying.length >= 12 ? 'HIGH' : qualifying.length >= 5 ? 'MEDIUM' : 'LOW';

  const topEfforts = [...qualifying]
    .sort((a, b) => b.total_elevation_gain - a.total_elevation_gain)
    .slice(0, 15)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      date: a.start_date.slice(0, 10),
      elevationGainFt: Math.round(a.total_elevation_gain * M_TO_FT),
      distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
      movingTimeMin: Math.round(a.moving_time / 60),
      verticalSpeedFtPerHr: Math.round((a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600)),
    }));

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedFtPerHr: Math.round(medVert),
    weeklyClimbingFt: Math.round(weeklyGainFt),
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
  };
}

// ── Sync ───────────────────────────────────────────────────────────────────

async function syncAthlete(id) {
  const { rows } = await pool.query('SELECT * FROM athletes WHERE id = $1', [id]);
  if (!rows.length) return null;
  const row = rows[0];

  const freshToken = await getValidToken(row);
  const activities = await fetchActivities(freshToken.access_token);
  const analysis = analyzeActivities(activities);
  const lastSyncedAt = Date.now();

  await pool.query(
    `UPDATE athletes
     SET access_token=$1, refresh_token=$2, expires_at=$3, analysis=$4, last_synced_at=$5
     WHERE id=$6`,
    [freshToken.access_token, freshToken.refresh_token, freshToken.expires_at,
      JSON.stringify(analysis), lastSyncedAt, id]
  );

  return toPublic({ ...row, analysis, last_synced_at: lastSyncedAt });
}

function toPublic(row) {
  return {
    id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    profile: row.profile,
    analysis: row.analysis ?? null,
    lastSyncedAt: row.last_synced_at ? Number(row.last_synced_at) : null,
  };
}

// ── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// List all athletes (no tokens)
app.get('/athletes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, firstname, lastname, profile, analysis, last_synced_at FROM athletes ORDER BY created_at'
    );
    res.json(rows.map(toPublic));
  } catch (e) {
    console.error('GET /athletes', e);
    res.status(500).json({ error: e.message });
  }
});

// Add/update athlete — receives token from client OAuth, stores it, syncs immediately
app.post('/athletes', async (req, res) => {
  const { token } = req.body;
  if (!token?.athlete?.id || !token.access_token || !token.refresh_token) {
    return res.status(400).json({ error: 'Missing token fields' });
  }
  const id = String(token.athlete.id);
  const { firstname, lastname, profile = '' } = token.athlete;

  try {
    await pool.query(
      `INSERT INTO athletes (id, firstname, lastname, profile, access_token, refresh_token, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE
         SET firstname=$2, lastname=$3, profile=$4,
             access_token=$5, refresh_token=$6, expires_at=$7`,
      [id, firstname, lastname, profile, token.access_token, token.refresh_token, token.expires_at]
    );
    const result = await syncAthlete(id);
    res.json(result);
  } catch (e) {
    console.error('POST /athletes', e);
    res.status(500).json({ error: e.message });
  }
});

// Re-sync an existing athlete
app.post('/athletes/:id/sync', async (req, res) => {
  try {
    const result = await syncAthlete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Athlete not found' });
    res.json(result);
  } catch (e) {
    console.error('POST /athletes/:id/sync', e);
    res.status(500).json({ error: e.message });
  }
});

// Remove an athlete
app.delete('/athletes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM athletes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /athletes/:id', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT ?? 3001;
initDb()
  .then(() => app.listen(PORT, () => console.log(`r2r2r API on :${PORT}`)))
  .catch((e) => { console.error('DB init failed', e); process.exit(1); });
