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
};
