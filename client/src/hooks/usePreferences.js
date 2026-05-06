import { useState, useCallback } from 'react';

const STORAGE_KEY = 'b1g_prefs_v1';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { sport: 'football', favoriteTeams: [], onboarded: false };
  } catch {
    return { sport: 'football', favoriteTeams: [], onboarded: false };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* storage full */ }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState(loadPrefs);

  const update = useCallback((patch) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const setFavoriteTeams = useCallback((teams) => {
    update({ favoriteTeams: teams, onboarded: true });
  }, [update]);

  const setSport = useCallback((sport) => {
    update({ sport });
  }, [update]);

  return { prefs, setFavoriteTeams, setSport };
}
