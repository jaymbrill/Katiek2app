import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

const MIN_ELEVATION_M = 305;      // 1,000 ft
const MIN_MOVING_TIME_S = 600;    // 10 minutes
const MIN_LONG_RUN_M = 16093.4;   // 10 miles
const M_TO_FT = 3.281;

// ft/hr thresholds (m/hr benchmarks × 3.281)
const ELITE_FT_HR = 2461;         // ≥750 m/hr
const STRONG_FT_HR = 1804;        // ≥550 m/hr
const INTERMEDIATE_FT_HR = 1148;  // ≥350 m/hr

// On-foot sport types for distance leaderboard (excludes biking & skiing)
const FOOT_SPORT_TYPES = new Set([
  'Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike', 'Snowshoe',
]);

export interface QualifyingEffort {
  id: number;
  name: string;
  sport_type: string;
  date: string;
  city: string;
  elevationGainFt: number;
  distanceMiles: number;
  movingTimeMin: number;
  verticalSpeedFtPerHr: number;
}

export interface HikeRunEffort {
  id: number;
  name: string;
  sport_type: string;
  date: string;
  city: string;
  distanceMiles: number;
  movingTimeMin: number;
  elevationGainFt: number;
}

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  totalActivities: number;
  medianVerticalSpeedFtPerHr: number;
  weeklyClimbingFt: number;
  longestHikeRunMiles: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  topSportTypes: string[];
  topEfforts: QualifyingEffort[];
  topHikeRunEfforts: HikeRunEffort[];
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function topTypes(activities: StravaActivity[]): string[] {
  const counts: Record<string, number> = {};
  for (const a of activities) counts[a.sport_type] = (counts[a.sport_type] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);
}

function cityLabel(a: StravaActivity): string {
  const parts = [a.location_city, a.location_state].filter(Boolean);
  return parts.join(', ');
}

export function analyzeActivities(activities: StravaActivity[]): StravaAnalysisResult {
  const total = activities.length;

  const qualifying = activities.filter(
    (a) => a.total_elevation_gain >= MIN_ELEVATION_M && a.moving_time >= MIN_MOVING_TIME_S
  );

  // Top 20 longest on-foot activities over 10 miles (no biking/skiing)
  const footLong = activities
    .filter((a) => FOOT_SPORT_TYPES.has(a.sport_type) && a.distance >= MIN_LONG_RUN_M)
    .sort((a, b) => b.distance - a.distance);

  const longestHikeRunMiles = footLong.length
    ? Math.round((footLong[0].distance / 1609.34) * 10) / 10
    : 0;

  const topHikeRunEfforts: HikeRunEffort[] = footLong.slice(0, 20).map((a) => ({
    id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    date: a.start_date.slice(0, 10),
    city: cityLabel(a),
    distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
    movingTimeMin: Math.round(a.moving_time / 60),
    elevationGainFt: Math.round(a.total_elevation_gain * M_TO_FT),
  }));

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedFtPerHr: 0,
      weeklyClimbingFt: 0,
      longestHikeRunMiles,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities in the past 2 years. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
      topHikeRunEfforts,
    };
  }

  // Vertical speed in ft/hr
  const vertSpeedsFtHr = qualifying.map(
    (a) => (a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600)
  );
  const medVertFtHr = median(vertSpeedsFtHr);

  // Weekly climbing volume over 2 years
  const totalGainFt = qualifying.reduce((s, a) => s + a.total_elevation_gain * M_TO_FT, 0);
  const weeklyGainFt = totalGainFt / 104;

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVertFtHr >= ELITE_FT_HR || weeklyGainFt >= 1970) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${Math.round(medVertFtHr).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFtHr >= STRONG_FT_HR || weeklyGainFt >= 1148) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${Math.round(medVertFtHr).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFtHr >= INTERMEDIATE_FT_HR || weeklyGainFt >= 492) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${Math.round(medVertFtHr).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${Math.round(medVertFtHr).toLocaleString()} ft/hr median vertical speed. More elevation training recommended.`;
  }

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    qualifying.length >= 12 ? 'HIGH' : qualifying.length >= 5 ? 'MEDIUM' : 'LOW';

  const topEfforts: QualifyingEffort[] = [...qualifying]
    .sort((a, b) => b.total_elevation_gain - a.total_elevation_gain)
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      date: a.start_date.slice(0, 10),
      city: cityLabel(a),
      elevationGainFt: Math.round(a.total_elevation_gain * M_TO_FT),
      distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
      movingTimeMin: Math.round(a.moving_time / 60),
      verticalSpeedFtPerHr: Math.round((a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600)),
    }));

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedFtPerHr: Math.round(medVertFtHr),
    weeklyClimbingFt: Math.round(weeklyGainFt),
    longestHikeRunMiles,
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
    topHikeRunEfforts,
  };
}
