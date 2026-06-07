import type { FitnessLevel, ScheduledSegment, TripDirection } from './types';
import segmentsData from '../constants/segments.json';

export const PACE_MULTIPLIERS: Record<FitnessLevel, number> = {
  BEGINNER: 1.5,
  INTERMEDIATE: 1.2,
  STRONG: 1.0,
  ELITE: 0.85,
};

export const ESTIMATED_HOURS: Record<FitnessLevel, number> = {
  BEGINNER: 32,
  INTERMEDIATE: 26,
  STRONG: 21,
  ELITE: 18,
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
