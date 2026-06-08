import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

// Activities excluded from analysis — skill-based or non-aerobic
const EXCLUDED_TYPES = new Set([
  'Golf', 'Yoga', 'WeightTraining', 'Crossfit', 'Stretching',
  'StandUpPaddling', 'Surfing', 'Windsurf', 'Kitesurf',
]);

// Minimum thresholds — low bar so cyclists/skiers/climbers qualify too
const MIN_DISTANCE_M = 3000;   // ~2 miles (or 0 for elevation-only sports like climbing)
const MIN_ELEVATION_M = 150;   // ~500 ft
const MIN_MOVING_TIME_S = 600; // 10 minutes

// Sports where elevation is the primary metric (distance often logged as 0 in Strava)
const ELEVATION_PRIMARY = new Set([
  'RockClimbing', 'IceClimbing', 'AlpineSkiing', 'BackcountrySki',
  'NordicSki', 'Snowboard', 'Snowshoe',
]);

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  totalActivities: number;
  medianVerticalSpeedMperHr: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  topSportTypes: string[];
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

  const qualifying = activities.filter((a) => {
    if (EXCLUDED_TYPES.has(a.sport_type)) return false;
    if (a.moving_time < MIN_MOVING_TIME_S) return false;
    if (a.total_elevation_gain < MIN_ELEVATION_M) return false;
    // For climbing/ski sports, don't require distance
    if (ELEVATION_PRIMARY.has(a.sport_type)) return true;
    return a.distance >= MIN_DISTANCE_M;
  });

  const topTypes_ = topTypes(qualifying);

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedMperHr: 0,
      confidence: 'LOW',
      reasoning: `No activities with 500+ ft gain found in the past year across ${total} total activities. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
    };
  }

  // Vertical speed (m/hr) = the best single predictor of canyon performance.
  // Measures how efficiently you convert effort into elevation — critical for
  // the 11,000 ft of climbing in R2R2R.
  const vertSpeeds = qualifying.map(
    (a) => a.total_elevation_gain / (a.moving_time / 3600)
  );
  const medVert = median(vertSpeeds);

  // Also compute weighted volume score: total vertical gain across the year
  const totalGainM = qualifying.reduce((s, a) => s + a.total_elevation_gain, 0);
  const weeklyGainM = totalGainM / 52;

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVert >= 750 || weeklyGainM >= 600) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg climbing across ${qualifying.length} activities.`;
  } else if (medVert >= 550 || weeklyGainM >= 350) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg climbing.`;
  } else if (medVert >= 350 || weeklyGainM >= 150) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg climbing.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${Math.round(medVert)} m/hr median vertical speed. Consider more elevation training before R2R2R.`;
  }

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    qualifying.length >= 12 ? 'HIGH' : qualifying.length >= 5 ? 'MEDIUM' : 'LOW';

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedMperHr: Math.round(medVert),
    confidence,
    reasoning,
    topSportTypes: topTypes_,
  };
}
