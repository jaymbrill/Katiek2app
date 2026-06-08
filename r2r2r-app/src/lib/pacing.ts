import type { FitnessLevel, ScheduledSegment, TripDirection } from './types';
import segmentsData from '../constants/segments.json';

// Multipliers calibrated against FKT data, CTS coaching guides, and trip reports:
// ELITE  ~9h  (sub-10h = community "elite" threshold; iRunFar, Outside Online)
// STRONG ~14h  (experienced trail runner; CTS: "11–15h for experienced runners")
// INTERMEDIATE ~18h (fit first-timers; CTS: "15–20h for first-time runners")
// BEGINNER ~24h (strong hiker; Outside Online: "18–24h for non-runners")
export const PACE_MULTIPLIERS: Record<FitnessLevel, number> = {
  BEGINNER: 1.75,
  INTERMEDIATE: 1.30,
  STRONG: 1.00,
  ELITE: 0.65,
};

export const ESTIMATED_HOURS: Record<FitnessLevel, number> = {
  BEGINNER: 24,
  INTERMEDIATE: 18,
  STRONG: 14,
  ELITE: 9,
};

export function generateScheduledSegments(
  fitnessLevel: FitnessLevel,
  startTime: Date,
  direction: TripDirection
): ScheduledSegment[] {
  const multiplier = PACE_MULTIPLIERS[fitnessLevel];
  const segments = direction === 'S_TO_N' ? segmentsData : [...segmentsData].reverse();

  let cursor = new Date(startTime);
  return segments.map((seg) => {
    const adjustedTimeMinutes = Math.round(seg.baseTimeMinutes * multiplier);
    const plannedStartTime = new Date(cursor);
    cursor = new Date(cursor.getTime() + adjustedTimeMinutes * 60 * 1000);
    return {
      ...seg,
      adjustedTimeMinutes,
      plannedStartTime,
      plannedEndTime: new Date(cursor),
      packed: false,
    };
  });
}

export function calculateTargetFinishTime(
  fitnessLevel: FitnessLevel,
  startTime: Date
): Date {
  const totalMinutes =
    segmentsData.reduce((sum, s) => sum + s.baseTimeMinutes, 0) *
    PACE_MULTIPLIERS[fitnessLevel];
  return new Date(startTime.getTime() + totalMinutes * 60 * 1000);
}

export function parseStartTime(tripDate: Date, startTimeStr: string): Date {
  const [hours, minutes] = startTimeStr.split(':').map(Number);
  const d = new Date(tripDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
