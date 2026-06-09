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
  await pool.query(`
    ALTER TABLE athletes
    ADD COLUMN IF NOT EXISTS trip_date TEXT NOT NULL DEFAULT '2026-10-07'
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

const FOOT_SPORT_TYPES = new Set([
  'Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike', 'Snowshoe',
]);

function cityLabel(a) {
  return [a.location_city, a.location_state].filter(Boolean).join(', ');
}

function analyzeActivities(activities) {
  const M_TO_FT = 3.281;
  const MIN_ELEVATION_M = 305;
  const MIN_MOVING_TIME_S = 600;
  const MIN_LONG_RUN_M = 16093.4; // 10 miles
  const ELITE_FT_HR = 2461;
  const STRONG_FT_HR = 1804;
  const INTERMEDIATE_FT_HR = 1148;

  const total = activities.length;
  const qualifying = activities.filter(
    (a) => a.total_elevation_gain >= MIN_ELEVATION_M && a.moving_time >= MIN_MOVING_TIME_S
  );

  // Top 20 longest on-foot activities over 10 miles (no biking/skiing)
  const footLong = activities
    .filter((a) => FOOT_SPORT_TYPES.has(a.sport_type) && a.distance >= MIN_LONG_RUN_M)
    .sort((a, b) => b.distance - a.distance);

  const longestHikeRunMiles = footLong.length
    ? Math.round((footLong[0].distance / 1609.34) * 10) / 10
    : 0;

  const topHikeRunEfforts = footLong.slice(0, 20).map((a) => ({
    id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    date: a.start_date.slice(0, 10),
    city: cityLabel(a),
    distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
    movingTimeMin: Math.round(a.moving_time / 60),
    elevationGainFt: Math.round(a.total_elevation_gain * M_TO_FT),
  }));

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedFtPerHr: 0,
      weeklyClimbingFt: 0,
      longestHikeRunMiles,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
      topHikeRunEfforts,
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
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      date: a.start_date.slice(0, 10),
      city: cityLabel(a),
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
    longestHikeRunMiles,
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
    topHikeRunEfforts,
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
    tripDate: row.trip_date ?? '2026-10-07',
    analysis: row.analysis ?? null,
    lastSyncedAt: row.last_synced_at ? Number(row.last_synced_at) : null,
  };
}

// ── Express ────────────────────────────────────────────────────────────────

const app = express();

// Allow all origins — tokens are stored server-side, no sensitive data is exposed to clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors()); // respond to preflight for all routes
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, db: dbReady }));

function requireDb(req, res, next) {
  if (!dbReady) return res.status(503).json({ error: 'Database not ready yet — try again in a few seconds' });
  next();
}

// List all athletes (no tokens)
app.get('/athletes', requireDb, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, firstname, lastname, profile, trip_date, analysis, last_synced_at FROM athletes ORDER BY created_at'
    );
    res.json(rows.map(toPublic));
  } catch (e) {
    console.error('GET /athletes', e);
    res.status(500).json({ error: e.message });
  }
});

// Add/update athlete — stores token immediately, returns partial record,
// syncs Strava data in the background (avoids Render's 30s request timeout)
app.post('/athletes', requireDb, async (req, res) => {
  const { token } = req.body;
  if (!token?.athlete?.id || !token.access_token || !token.refresh_token) {
    return res.status(400).json({ error: 'Missing token fields' });
  }
  const id = String(token.athlete.id);
  const { firstname, lastname, profile = '' } = token.athlete;
  const tripDate = req.body.tripDate ?? '2026-10-07';

  try {
    await pool.query(
      `INSERT INTO athletes (id, firstname, lastname, profile, access_token, refresh_token, expires_at, trip_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE
         SET firstname=$2, lastname=$3, profile=$4,
             access_token=$5, refresh_token=$6, expires_at=$7, trip_date=$8`,
      [id, firstname, lastname, profile, token.access_token, token.refresh_token, token.expires_at, tripDate]
    );

    // Return immediately so the client isn't blocked waiting for Strava fetch
    res.json({ id, firstname, lastname, profile, tripDate, analysis: null, lastSyncedAt: null });

    // Sync in background — client polls GET /athletes until analysis appears
    syncAthlete(id).catch((e) => console.error(`Background sync failed for ${id}:`, e.message));
  } catch (e) {
    console.error('POST /athletes', e);
    res.status(500).json({ error: e.message });
  }
});

// Re-sync an existing athlete
app.post('/athletes/:id/sync', requireDb, async (req, res) => {
  try {
    const result = await syncAthlete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Athlete not found' });
    res.json(result);
  } catch (e) {
    console.error('POST /athletes/:id/sync', e);
    res.status(500).json({ error: e.message });
  }
});

// Update an athlete's trip date
app.patch('/athletes/:id/trip-date', requireDb, async (req, res) => {
  const { tripDate } = req.body;
  if (!tripDate || !/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) {
    return res.status(400).json({ error: 'Invalid tripDate — expected YYYY-MM-DD' });
  }
  try {
    await pool.query('UPDATE athletes SET trip_date=$1 WHERE id=$2', [tripDate, req.params.id]);
    res.json({ ok: true, tripDate });
  } catch (e) {
    console.error('PATCH /athletes/:id/trip-date', e);
    res.status(500).json({ error: e.message });
  }
});

// Remove an athlete
app.delete('/athletes/:id', requireDb, async (req, res) => {
  try {
    await pool.query('DELETE FROM athletes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /athletes/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// Start listening immediately so Render's health check passes,
// then init the DB in the background with retries.
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`r2r2r API on :${PORT}`));

let dbReady = false;

async function initWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await initDb();
      dbReady = true;
      console.log('DB ready');
      return;
    } catch (e) {
      console.error(`DB init attempt ${i}/${attempts} failed:`, e.message);
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error('DB init gave up after', attempts, 'attempts');
}

initWithRetry();
