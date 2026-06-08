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
  loadAthletes: () => Promise<void>;
  addAthlete: (token: StravaToken) => Promise<void>;
  removeAthlete: (athleteId: string) => Promise<void>;
  syncAthlete: (athleteId: string) => Promise<void>;
}

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  if (!API_URL) throw new Error('API not configured (EXPO_PUBLIC_API_URL missing)');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json;
}

export const useStravaStore = create<StravaStore>((set, get) => ({
  athletes: [],
  syncingIds: [],
  errors: {},
  loaded: false,

  loadAthletes: async () => {
    try {
      const athletes: AthleteRecord[] = await apiFetch('/athletes');
      set({ athletes, loaded: true });
    } catch (e: any) {
      set({ loaded: true });
    }
  },

  addAthlete: async (token) => {
    const id = String(token.athlete.id);
    set((s) => ({ syncingIds: [...s.syncingIds, id], errors: { ...s.errors, [id]: '' } }));
    try {
      const record: AthleteRecord = await apiFetch('/athletes', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      set((s) => ({
        athletes: [...s.athletes.filter((a) => a.id !== record.id), record],
        syncingIds: s.syncingIds.filter((i) => i !== id),
      }));
    } catch (e: any) {
      set((s) => ({
        syncingIds: s.syncingIds.filter((i) => i !== id),
        errors: { ...s.errors, [id]: e?.message ?? 'Failed to connect' },
      }));
    }
  },

  removeAthlete: async (athleteId) => {
    set((s) => ({ athletes: s.athletes.filter((a) => a.id !== athleteId) }));
    try {
      await apiFetch(`/athletes/${athleteId}`, { method: 'DELETE' });
    } catch {
      // Optimistic removal — ignore errors
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
      set((s) => ({
        syncingIds: s.syncingIds.filter((i) => i !== athleteId),
        errors: { ...s.errors, [athleteId]: e?.message ?? 'Sync failed' },
      }));
    }
  },
}));
