import { Platform } from 'react-native';

export interface StravaToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  distance: number;           // meters
  moving_time: number;        // seconds
  elapsed_time: number;       // seconds
  total_elevation_gain: number; // meters
  start_date: string;
  location_city?: string | null;
  location_state?: string | null;
}

const CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';

export function getRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Use root URL so Render always serves index.html — code param handled in layout
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_STRAVA_REDIRECT_URI ?? '';
}

export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state: 'strava_oauth',
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<StravaToken> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token exchange failed: ${body}`);
  }
  return res.json();
}

export async function refreshAccessToken(token: StravaToken): Promise<StravaToken> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Strava token refresh failed');
  return res.json();
}

export async function getValidToken(token: StravaToken): Promise<StravaToken> {
  // refresh 5 minutes before expiry
  if (Date.now() / 1000 < token.expires_at - 300) return token;
  return refreshAccessToken(token);
}

export async function fetchYearOfActivities(accessToken: string): Promise<StravaActivity[]> {
  const after = Math.floor((Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) / 1000);
  const all: StravaActivity[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error('Failed to fetch Strava activities');
    const batch: StravaActivity[] = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    page++;
    if (page > 40) break; // safety cap: 4000 activities
  }
  return all;
}
