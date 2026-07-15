async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  scores:    (sport) => apiFetch(`/api/scores/${sport}`),
  standings: (sport) => apiFetch(`/api/standings/${sport}`),
  rankings:  (sport) => apiFetch(`/api/rankings/${sport}`),
  schedule:  (sport) => apiFetch(`/api/schedule/${sport}`),
  teams:     ()      => apiFetch('/api/teams'),

  strava: {
    status:         ()     => apiFetch('/api/strava/status'),
    authUrl:        ()     => apiFetch('/api/strava/auth'),
    activities:     (days) => apiFetch(`/api/strava/activities?days=${days || 14}`),
    recommendation: (date) => apiFetch(`/api/strava/recommendation${date ? '?date=' + date : ''}`),
    overview:       ()     => apiFetch('/api/strava/overview'),
    notify:         ()     => fetch('/api/strava/notify', { method: 'POST' }).then(r => r.json()),
  },
};
