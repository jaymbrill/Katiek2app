import type { Forecast } from './types';

const NWS_URL = 'https://api.weather.gov/gridpoints/FGZ/52,49/forecast/hourly';

export async function fetchForecast(): Promise<Forecast> {
  const res = await fetch(NWS_URL, {
    headers: { 'User-Agent': 'R2R2R-Companion-App (contact@r2r2r.app)' },
  });

  if (!res.ok) throw new Error(`NWS fetch failed: ${res.status}`);

  const data = await res.json();
  const periods: any[] = data.properties?.periods ?? [];

  // Inner Gorge is ~15°F warmer than rim forecasts
  // NWS FGZ/52,49 is Phantom Ranch zone — use directly
  const temps: number[] = periods.slice(0, 30).map((p: any) => p.temperature);
  const highF = Math.max(...temps, 0);

  return {
    innerGorgeHighF: highF,
    hourlyTemps: temps,
    summary: periods[0]?.shortForecast ?? 'No forecast available',
    lastUpdated: new Date(),
  };
}

export function getFallbackForecast(tripDate: Date): Forecast {
  const month = tripDate.getMonth() + 1;
  let baseHigh = 90;
  if (month >= 6 && month <= 9) baseHigh = 108;
  else if (month >= 4 && month <= 5) baseHigh = 95;
  else if (month >= 10 && month <= 11) baseHigh = 78;
  else baseHigh = 62;

  const hourlyTemps = Array.from({ length: 30 }, (_, i) => {
    const factor = Math.sin((Math.PI * Math.max(0, i - 2)) / 26);
    return Math.round(baseHigh * 0.6 + baseHigh * 0.4 * factor);
  });

  return {
    innerGorgeHighF: baseHigh,
    hourlyTemps,
    summary: 'Seasonal estimate (offline)',
    lastUpdated: new Date(0),
  };
}
