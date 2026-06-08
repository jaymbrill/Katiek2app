import { create } from 'zustand';
import { Platform } from 'react-native';
import type { StravaToken } from '../lib/strava';
import type { StravaAnalysisResult } from '../lib/stravaAnalysis';
import { getValidToken, fetchYearOfActivities } from '../lib/strava';
import { analyzeActivities } from '../lib/stravaAnalysis';

const STORAGE_KEY = 'r2r2r_strava';

interface Persisted {
  token: StravaToken | null;
  analysis: StravaAnalysisResult | null;
  lastSyncedAt: number | null;
}

function load(): Persisted {
  if (Platform.OS !== 'web') return { token: null, analysis: null, lastSyncedAt: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, analysis: null, lastSyncedAt: null };
  } catch {
    return { token: null, analysis: null, lastSyncedAt: null };
  }
}

function persist(data: Persisted) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

interface StravaStore extends Persisted {
  syncing: boolean;
  error: string | null;
  setToken: (token: StravaToken) => Promise<void>;
  disconnect: () => void;
  sync: () => Promise<void>;
}

const initial = load();

export const useStravaStore = create<StravaStore>((set, get) => ({
  ...initial,
  syncing: false,
  error: null,

  setToken: async (token) => {
    set({ token, error: null });
    persist({ token, analysis: get().analysis, lastSyncedAt: get().lastSyncedAt });
    await get().sync();
  },

  disconnect: () => {
    set({ token: null, analysis: null, lastSyncedAt: null, error: null });
    if (Platform.OS === 'web') localStorage.removeItem(STORAGE_KEY);
  },

  sync: async () => {
    const { token } = get();
    if (!token) return;
    set({ syncing: true, error: null });
    try {
      const validToken = await getValidToken(token);
      if (validToken !== token) {
        set({ token: validToken });
      }
      const activities = await fetchYearOfActivities(validToken.access_token);
      const analysis = analyzeActivities(activities);
      const lastSyncedAt = Date.now();
      set({ analysis, lastSyncedAt, syncing: false, token: validToken });
      persist({ token: validToken, analysis, lastSyncedAt });
    } catch (e: any) {
      set({ syncing: false, error: e?.message ?? 'Sync failed' });
    }
  },
}));
