import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

// 1000 ft in meters
const MIN_ELEVATION_M = 305;
const MIN_MOVING_TIME_S = 600; // 10 minutes

export interface QualifyingEffort {
  id: number;
  name: string;
  sport_type: string;
  date: string;
  elevationGainFt: number;
  distanceMiles: number;
  movingTimeMin: number;
  verticalSpeedMperHr: number;
}

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  totalActivities: number;
  medianVerticalSpeedMperHr: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  topSportTypes: string[];
  topEfforts: QualifyingEffort[]; // top 15 by elevation gain
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

  // All activities with 1000+ ft gain and at least 10 min moving time
  const qualifying = activities.filter(
    (a) => a.total_elevation_gain >= MIN_ELEVATION_M && a.moving_time >= MIN_MOVING_TIME_S
  );

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      totalActivities: total,
      medianVerticalSpeedMperHr: 0,
      confidence: 'LOW',
      reasoning: `No activities with 1,000+ ft of gain found across ${total} total activities in the past 2 years. Defaulting to Intermediate.`,
      topSportTypes: topTypes(activities),
      topEfforts: [],
    };
  }

  // Vertical speed (m/hr): primary predictor of canyon performance
  const vertSpeeds = qualifying.map(
    (a) => a.total_elevation_gain / (a.moving_time / 3600)
  );
  const medVert = median(vertSpeeds);

  // Weekly climbing volume over 2 years
  const totalGainM = qualifying.reduce((s, a) => s + a.total_elevation_gain, 0);
  const weeklyGainM = totalGainM / 104; // 2 years = 104 weeks

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVert >= 750 || weeklyGainM >= 600) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg gain over 2 years.`;
  } else if (medVert >= 550 || weeklyGainM >= 350) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg gain.`;
  } else if (medVert >= 350 || weeklyGainM >= 150) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: ${Math.round(medVert)} m/hr median vertical speed, ${Math.round(weeklyGainM)} m/week avg gain.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: ${Math.round(medVert)} m/hr median vertical speed. More elevation training recommended before R2R2R.`;
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
      elevationGainFt: Math.round(a.total_elevation_gain * 3.281),
      distanceMiles: Math.round((a.distance / 1609.34) * 10) / 10,
      movingTimeMin: Math.round(a.moving_time / 60),
      verticalSpeedMperHr: Math.round(a.total_elevation_gain / (a.moving_time / 3600)),
    }));

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    totalActivities: total,
    medianVerticalSpeedMperHr: Math.round(medVert),
    confidence,
    reasoning,
    topSportTypes: topTypes(qualifying),
    topEfforts,
  };
}
