async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  status:         ()     => apiFetch('/api/strava/status'),
  authUrl:        ()     => apiFetch('/api/strava/auth'),
  activities:     (days) => apiFetch(`/api/strava/activities?days=${days || 14}`),
  recommendation: (date) => apiFetch(`/api/strava/recommendation${date ? '?date=' + date : ''}`),
  overview:       ()     => apiFetch('/api/strava/overview'),
  preferences:    ()     => apiFetch('/api/strava/preferences'),
  updatePrefs:    (data) => fetch('/api/strava/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
  notify:         ()     => fetch('/api/strava/notify', { method: 'POST' }).then(r => r.json()),
  health:         ()     => apiFetch('/api/strava/health'),
};
