import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

const MIN_ELEVATION_M = 305;   // 1,000 ft
const MIN_MOVING_TIME_S = 600; // 10 minutes
const M_TO_FT = 3.281;

// ft/hr thresholds (converted from m/hr research benchmarks)
const ELITE_FT_HR = 2460;        // ≥750 m/hr
const STRONG_FT_HR = 1804;       // ≥550 m/hr
const INTERMEDIATE_FT_HR = 1148; // ≥350 m/hr

export interface QualifyingEffort {
  id: number;
  name: string;
  sport_type: string;
  date: string;
  elevationGainFt: number;
  distanceMiles: number;
  movingTimeMin: number;
  verticalSpeedFtPerHr: number;
}

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  totalActivities: number;
  medianVerticalSpeedFtPerHr: number;
  weeklyClimbingFt: number;
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

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedFtPerHr: 0,
      weeklyClimbingFt: 0,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities in the past 2 years. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
    };
  }

  // Vertical speed in ft/hr
  const vertSpeedsFt = qualifying.map(
    (a) => (a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600)
  );
  const medVertFt = median(vertSpeedsFt);

  // Weekly climbing volume over 2 years in feet
  const totalGainFt = qualifying.reduce((s, a) => s + a.total_elevation_gain * M_TO_FT, 0);
  const weeklyGainFt = totalGainFt / 104;

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVertFt >= ELITE_FT_HR || weeklyGainFt >= 1970) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${Math.round(medVertFt).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFt >= STRONG_FT_HR || weeklyGainFt >= 1148) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${Math.round(medVertFt).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else if (medVertFt >= INTERMEDIATE_FT_HR || weeklyGainFt >= 492) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${Math.round(medVertFt).toLocaleString()} ft/hr median vertical speed, ${Math.round(weeklyGainFt).toLocaleString()} ft/week avg climbing.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${Math.round(medVertFt).toLocaleString()} ft/hr median vertical speed. More elevation training recommended.`;
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
      verticalSpeedFtPerHr: Math.round((a.total_elevation_gain * M_TO_FT) / (a.moving_time / 3600)),
    }));

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedFtPerHr: Math.round(medVertFt),
    weeklyClimbingFt: Math.round(weeklyGainFt),
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
  };
}
