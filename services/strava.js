const https = require('https');
const fs = require('fs');
const path = require('path');

const STRAVA_API = 'www.strava.com';
const STRAVA_API_V3 = 'www.strava.com/api/v3';
const TOKEN_PATH = path.join(__dirname, '..', '.strava-tokens.json');

function getConfig() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    redirectUri: process.env.STRAVA_REDIRECT_URI || 'http://localhost:3001/api/strava/callback',
  };
}

function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function getAuthUrl() {
  const { clientId, redirectUri } = getConfig();
  const scope = 'read,activity:read_all';
  return `https://${STRAVA_API}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
}

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function exchangeCode(code) {
  const { clientId, clientSecret } = getConfig();
  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  }).toString();

  const res = await httpsRequest({
    hostname: STRAVA_API,
    path: '/oauth/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);

  if (res.status !== 200) throw new Error(`Strava auth failed: ${JSON.stringify(res.data)}`);

  const tokens = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: res.data.expires_at,
    athlete: res.data.athlete,
  };
  saveTokens(tokens);
  return tokens;
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens) throw new Error('No Strava tokens found. Please connect Strava first.');

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at > now + 300) return tokens.access_token;

  const { clientId, clientSecret } = getConfig();
  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  }).toString();

  const res = await httpsRequest({
    hostname: STRAVA_API,
    path: '/oauth/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);

  if (res.status !== 200) throw new Error(`Token refresh failed: ${JSON.stringify(res.data)}`);

  tokens.access_token = res.data.access_token;
  tokens.refresh_token = res.data.refresh_token;
  tokens.expires_at = res.data.expires_at;
  saveTokens(tokens);
  return tokens.access_token;
}

async function apiGet(endpoint, params = {}) {
  const token = await refreshAccessToken();
  const query = new URLSearchParams(params).toString();
  const fullPath = `/api/v3${endpoint}${query ? '?' + query : ''}`;

  const res = await httpsRequest({
    hostname: 'www.strava.com',
    path: fullPath,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) throw new Error(`Strava API error ${res.status}: ${JSON.stringify(res.data)}`);
  return res.data;
}

async function getAthlete() {
  return apiGet('/athlete');
}

async function getActivities(after, before, perPage = 100) {
  const params = { per_page: perPage };
  if (after) params.after = Math.floor(new Date(after).getTime() / 1000);
  if (before) params.before = Math.floor(new Date(before).getTime() / 1000);
  return apiGet('/athlete/activities', params);
}

async function getRecentActivities(days = 14) {
  const after = new Date();
  after.setDate(after.getDate() - days);
  return getActivities(after.toISOString());
}

async function getActivityDetail(id) {
  return apiGet(`/activities/${id}`);
}

function isConnected() {
  const tokens = loadTokens();
  return !!tokens && !!tokens.access_token;
}

function getAthleteInfo() {
  const tokens = loadTokens();
  return tokens?.athlete || null;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getAthlete,
  getActivities,
  getRecentActivities,
  getActivityDetail,
  isConnected,
  getAthleteInfo,
  refreshAccessToken,
};
