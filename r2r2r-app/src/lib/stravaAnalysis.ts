import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

const MIN_ELEVATION_M = 305;      // 1,000 ft
const MIN_MOVING_TIME_S = 600;    // 10 minutes
const MIN_LONG_RUN_M = 16093.4;   // 10 miles
const M_TO_FT = 3.281;

// ft/min thresholds (ft/hr ÷ 60, from m/hr research benchmarks)
const ELITE_FT_MIN = 41;          // ≥750 m/hr → 41 ft/min
const STRONG_FT_MIN = 30;         // ≥550 m/hr → 30 ft/min
const INTERMEDIATE_FT_MIN = 19;   // ≥350 m/hr → 19 ft/min

export interface QualifyingEffort {
  id: number;
  name: string;
  sport_type: string;
  date: string;
  elevationGainFt: number;
  distanceMiles: number;
  movingTimeMin: number;
  verticalSpeedFtPerMin: number;
}

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  totalActivities: number;
  medianVerticalSpeedFtPerMin: number;
  weeklyClimbingFt: number;
  longestRunMiles: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  topSportTypes: string[];
  topEfforts: QualifyingEffort[];
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

export function analyzeActivities(activities: StravaActivity[]): StravaAnalysisResult {
  const total = activities.length;

  const qualifying = activities.filter(
    (a) => a.total_elevation_gain >= MIN_ELEVATION_M && a.moving_time >= MIN_MOVING_TIME_S
  );

  // Longest run over 10 miles across all activities
  const longRuns = activities.filter((a) => a.distance >= MIN_LONG_RUN_M);
  const longestRunMiles = longRuns.length
    ? Math.round((Math.max(...longRuns.map((a) => a.distance)) / 1609.34) * 10) / 10
    : 0;

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedFtPerMin: 0,
      weeklyClimbingFt: 0,
      longestRunMiles,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities in the past 2 years. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
    };
  }

  // Vertical speed in ft/min
  const vertSpeedsFtMin = qualifying.map(
    (a) => (a.total_elevation_gain * M_TO_FT) / (a.moving_time / 60)
  );
  const medVertFtMin = median(vertSpeedsFtMin);

  // Weekly climbing volume over 2 years in feet
  const totalGainFt = qualifying.reduce((s, a) => s + a.total_elevation_gain * M_TO_FT, 0);
  const weeklyGainFt = totalGainFt / 104;

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVertFtMin >= ELITE_FT_MIN || weeklyGainFt >= 1970) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${medVertFtMin.toFixed(1)} ft/min median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFtMin >= STRONG_FT_MIN || weeklyGainFt >= 1148) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${medVertFtMin.toFixed(1)} ft/min median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFtMin >= INTERMEDIATE_FT_MIN || weeklyGainFt >= 492) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${medVertFtMin.toFixed(1)} ft/min median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${medVertFtMin.toFixed(1)} ft/min median vertical speed. More elevation training recommended.`;
  }

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    qualifying.length >= 12 ? 'HIGH' : qualifying.length >= 5 ? 'MEDIUM' : 'LOW';

  const topEfforts: QualifyingEffort[] = [...qualifying]
    .sort((a, b) => b.total_elevation_gain - a.total_elevation_gain)
    .slice(0, 15)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      date: a.start_date.slice(0, 10),
      elevationGainFt: Math.round(a.total_elevation_gain * M_TO_FT),
      distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
      movingTimeMin: Math.round(a.moving_time / 60),
      verticalSpeedFtPerMin: Math.round((a.total_elevation_gain * M_TO_FT) / (a.moving_time / 60) * 10) / 10,
    }));

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedFtPerMin: Math.round(medVertFtMin * 10) / 10,
    weeklyClimbingFt: Math.round(weeklyGainFt),
    longestRunMiles,
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
  };
}
