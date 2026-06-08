import type { FitnessLevel } from './types';
import type { StravaActivity } from './strava';

// Activities that involve sustained effort over terrain similar to R2R2R
const QUALIFYING_TYPES = new Set([
  'Run', 'TrailRun', 'Hike', 'Walk', 'VirtualRun',
]);

const MIN_DISTANCE_M = 8047;  // 5 miles
const MIN_ELEVATION_M = 300;  // ~1000 ft

export interface StravaAnalysisResult {
  suggestedLevel: FitnessLevel;
  qualifyingCount: number;
  medianVerticalSpeedMperHr: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function analyzeActivities(activities: StravaActivity[]): StravaAnalysisResult {
  const qualifying = activities.filter(
    (a) =>
      QUALIFYING_TYPES.has(a.sport_type) &&
      a.distance >= MIN_DISTANCE_M &&
      a.total_elevation_gain >= MIN_ELEVATION_M &&
      a.moving_time > 0
  );

  if (!qualifying.length) {
    return {
      suggestedLevel: 'INTERMEDIATE',
      qualifyingCount: 0,
      medianVerticalSpeedMperHr: 0,
      confidence: 'LOW',
      reasoning: 'No qualifying hike/run activities (5+ mi, 1000+ ft gain) found in the past year. Defaulting to Intermediate.',
    };
  }

  // Vertical speed: elevation gain (m) per hour of moving time
  // Primary predictor of canyon fitness — directly related to uphill power output
  const vertSpeeds = qualifying.map(
    (a) => a.total_elevation_gain / (a.moving_time / 3600)
  );
  const medVert = median(vertSpeeds);

  let suggestedLevel: FitnessLevel;
  let reasoning: string;

  if (medVert >= 750) {
    suggestedLevel = 'ELITE';
    reasoning = `Elite: median ${Math.round(medVert)} m/hr vertical, consistent with ultra-endurance mountain athletes.`;
  } else if (medVert >= 550) {
    suggestedLevel = 'STRONG';
    reasoning = `Strong: median ${Math.round(medVert)} m/hr vertical, experienced and well-conditioned.`;
  } else if (medVert >= 350) {
    suggestedLevel = 'INTERMEDIATE';
    reasoning = `Intermediate: median ${Math.round(medVert)} m/hr vertical, solid fitness base.`;
  } else {
    suggestedLevel = 'BEGINNER';
    reasoning = `Beginner: median ${Math.round(medVert)} m/hr vertical. Take extra time in the canyon.`;
  }

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    qualifying.length >= 10 ? 'HIGH' : qualifying.length >= 4 ? 'MEDIUM' : 'LOW';

  return {
    suggestedLevel,
    qualifyingCount: qualifying.length,
    medianVerticalSpeedMperHr: Math.round(medVert),
    confidence,
    reasoning,
  };
}
