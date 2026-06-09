import { create } from 'zustand';
import type { StravaToken } from '../lib/strava';
import type { StravaAnalysisResult } from '../lib/stravaAnalysis';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export interface AthleteRecord {
  id: string;
  firstname: string;
  lastname: string;
  profile: string;
  analysis: StravaAnalysisResult | null;
  lastSyncedAt: number | null;
}

interface StravaStore {
  athletes: AthleteRecord[];
  syncingIds: string[];
  errors: Record<string, string>;
  loaded: boolean;
  // Global state for the initial OAuth connect flow
  connecting: boolean;
  connectError: string;
  loadAthletes: () => Promise<void>;
  addAthlete: (token: StravaToken) => Promise<void>;
  removeAthlete: (athleteId: string) => Promise<void>;
  syncAthlete: (athleteId: string) => Promise<void>;
}

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  if (!API_URL) throw new Error('API URL not configured — set EXPO_PUBLIC_API_URL in Render and redeploy the static site.');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  // For error responses, try to extract the error message but don't crash
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `API error ${res.status}`);
  }
  // For success responses, parse body as text first so we get a clear error if it's empty or non-JSON
  const text = await res.text();
  if (!text) throw new Error(`API at ${API_URL}${path} returned empty response — check the service is running at /health`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON (${text.slice(0, 80)}…) — is EXPO_PUBLIC_API_URL pointing at the right service?`);
  }
}

// Poll GET /athletes until the given athlete has analysis populated
async function pollForAnalysis(athleteId: string) {
  const MAX = 40; // ~3 min at 5s intervals
  for (let i = 0; i < MAX; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const data = await apiFetch('/athletes');
      const updated = Array.isArray(data) ? data.find((a: any) => a?.id === athleteId) : null;
      if (updated?.analysis) {
        useStravaStore.setState((s) => ({
          athletes: s.athletes.map((a) => (a.id === athleteId ? updated : a)),
          syncingIds: s.syncingIds.filter((id) => id !== athleteId),
        }));
        return;
      }
    } catch {}
  }
  // Timed out
  useStravaStore.setState((s) => ({
    syncingIds: s.syncingIds.filter((id) => id !== athleteId),
    errors: { ...s.errors, [athleteId]: 'Analysis timed out — tap Refresh to try again' },
  }));
}

export const useStravaStore = create<StravaStore>((set, get) => ({
  athletes: [],
  syncingIds: [],
  errors: {},
  loaded: false,
  connecting: false,
  connectError: '',

  loadAthletes: async () => {
    try {
      const data = await apiFetch('/athletes');
      const athletes: AthleteRecord[] = Array.isArray(data)
        ? data.filter((a: any) => a?.id && a?.firstname)
        : [];
      set({ athletes, loaded: true });
    } catch (e: any) {
      console.warn('loadAthletes failed:', e?.message);
      set({ loaded: true });
    }
  },

  addAthlete: async (token) => {
    // Guard against malformed token (missing athlete data = env vars not set)
    if (!token?.athlete?.id || !token?.access_token) {
      const msg = 'Strava token is missing athlete data. Make sure EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET are set in Render and the static site was redeployed after setting them.';
      console.error('addAthlete:', msg, token);
      set({ connecting: false, connectError: msg });
      return;
    }
    const id = String(token.athlete.id);
    set({ connecting: true, connectError: '' });
    try {
      const record: AthleteRecord = await apiFetch('/athletes', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (!record?.id || !record?.firstname) {
        throw new Error(`API returned invalid athlete data: ${JSON.stringify(record)}`);
      }
      // Add the athlete immediately (analysis is null until background sync finishes)
      set((s) => ({
        athletes: [...s.athletes.filter((a) => a.id !== record.id), record],
        connecting: false,
        connectError: '',
        syncingIds: record.analysis ? s.syncingIds : [...s.syncingIds, record.id],
      }));
      // If analysis isn't ready yet, poll until the background sync completes
      if (!record.analysis) pollForAnalysis(record.id);
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to connect Strava';
      console.error('addAthlete failed:', msg);
      set({ connecting: false, connectError: msg });
    }
  },

  removeAthlete: async (athleteId) => {
    set((s) => ({ athletes: s.athletes.filter((a) => a.id !== athleteId) }));
    try {
      await apiFetch(`/athletes/${athleteId}`, { method: 'DELETE' });
    } catch (e: any) {
      console.warn('removeAthlete failed:', e?.message);
    }
  },

  syncAthlete: async (athleteId) => {
    set((s) => ({ syncingIds: [...s.syncingIds, athleteId], errors: { ...s.errors, [athleteId]: '' } }));
    try {
      const record: AthleteRecord = await apiFetch(`/athletes/${athleteId}/sync`, { method: 'POST' });
      set((s) => ({
        athletes: s.athletes.map((a) => (a.id === athleteId ? record : a)),
        syncingIds: s.syncingIds.filter((i) => i !== athleteId),
      }));
    } catch (e: any) {
      const msg = e?.message ?? 'Sync failed';
      console.error('syncAthlete failed:', msg);
      set((s) => ({
        syncingIds: s.syncingIds.filter((i) => i !== athleteId),
        errors: { ...s.errors, [athleteId]: msg },
      }));
    }
  },
}));
