import { create } from 'zustand';
import { Platform } from 'react-native';
import type { StravaToken } from '../lib/strava';
import type { StravaAnalysisResult } from '../lib/stravaAnalysis';
import { getValidToken, fetchYearOfActivities } from '../lib/strava';
import { analyzeActivities } from '../lib/stravaAnalysis';

const STORAGE_KEY = 'r2r2r_strava_v2';

export interface AthleteRecord {
  id: string;
  token: StravaToken;
  analysis: StravaAnalysisResult | null;
  lastSyncedAt: number | null;
}

interface Persisted {
  athletes: AthleteRecord[];
}

function load(): Persisted {
  if (Platform.OS !== 'web') return { athletes: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { athletes: [] };
  } catch {
    return { athletes: [] };
  }
}

function persist(data: Persisted) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

interface StravaStore extends Persisted {
  syncingIds: string[];
  errors: Record<string, string>;
  addAthlete: (token: StravaToken) => Promise<void>;
  removeAthlete: (athleteId: string) => void;
  syncAthlete: (athleteId: string) => Promise<void>;
}

const initial = load();

export const useStravaStore = create<StravaStore>((set, get) => ({
  ...initial,
  syncingIds: [],
  errors: {},

  addAthlete: async (token) => {
    const id = String(token.athlete.id);
    const existing = get().athletes.find((a) => a.id === id);
    const newRecord: AthleteRecord = {
      id,
      token,
      analysis: existing?.analysis ?? null,
      lastSyncedAt: existing?.lastSyncedAt ?? null,
    };
    const athletes = [...get().athletes.filter((a) => a.id !== id), newRecord];
    set({ athletes });
    persist({ athletes });
    await get().syncAthlete(id);
  },

  removeAthlete: (athleteId) => {
    const athletes = get().athletes.filter((a) => a.id !== athleteId);
    set({ athletes });
    persist({ athletes });
  },

  syncAthlete: async (athleteId) => {
    const record = get().athletes.find((a) => a.id === athleteId);
    if (!record) return;
    set((s) => ({ syncingIds: [...s.syncingIds, athleteId], errors: { ...s.errors, [athleteId]: '' } }));
    try {
      const validToken = await getValidToken(record.token);
      const activities = await fetchYearOfActivities(validToken.access_token);
      const analysis = analyzeActivities(activities);
      const lastSyncedAt = Date.now();
      set((s) => {
        const athletes = s.athletes.map((a) =>
          a.id === athleteId ? { ...a, token: validToken, analysis, lastSyncedAt } : a
        );
        persist({ athletes });
        return { athletes, syncingIds: s.syncingIds.filter((id) => id !== athleteId) };
      });
    } catch (e: any) {
      set((s) => ({
        syncingIds: s.syncingIds.filter((id) => id !== athleteId),
        errors: { ...s.errors, [athleteId]: e?.message ?? 'Sync failed' },
      }));
    }
  },
}));
