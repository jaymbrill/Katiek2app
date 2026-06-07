import type { HydrationPlan, HourlyTarget, ScheduledSegment } from './types';

const BASE_OZ_PER_HOUR = 20;
const MAX_OZ_PER_HOUR = 32;
const TEMP_THRESHOLD = 80;
const HIGH_TEMP_THRESHOLD = 100;
const OZ_PER_10F = 4;
const OZ_PER_LB = 0.04; // slight scaling with body weight

export function generateHydrationPlan(
  bodyWeightLbs: number,
  scheduledSegments: ScheduledSegment[],
  hourlyTemps: number[]
): HydrationPlan {
  if (scheduledSegments.length === 0) {
    return { hourlySchedule: [], totalWaterLiters: 0, totalElectrolyteDoses: 0 };
  }

  const totalMinutes = scheduledSegments.reduce((s, seg) => s + seg.adjustedTimeMinutes, 0);
  const totalHours = Math.ceil(totalMinutes / 60);

  const schedule: HourlyTarget[] = [];
  let electrolyteDoses = 0;
  let totalOz = 0;

  for (let hour = 0; hour < totalHours; hour++) {
    const tempF = hourlyTemps[hour] ?? hourlyTemps[hourlyTemps.length - 1] ?? 90;
    const segment = getSegmentAtHour(hour, scheduledSegments);

    const tempExcess = Math.max(0, tempF - TEMP_THRESHOLD);
    const tempBonus = Math.floor(tempExcess / 10) * OZ_PER_10F;
    const weightBonus = Math.round((bodyWeightLbs - 150) * OZ_PER_LB);
    const rawOz = BASE_OZ_PER_HOUR + tempBonus + Math.max(0, weightBonus);
    const waterOz = Math.min(rawOz, MAX_OZ_PER_HOUR);

    // Electrolytes every other hour; every hour above 100°F
    const needsElectrolytes = tempF >= HIGH_TEMP_THRESHOLD || hour % 2 === 1;
    if (needsElectrolytes) electrolyteDoses++;
    totalOz += waterOz;

    schedule.push({
      hour,
      segment: segment?.name ?? 'Unknown',
      waterOz,
      electrolytes: needsElectrolytes,
      tempF,
      notes: tempF >= HIGH_TEMP_THRESHOLD ? 'Extreme heat – drink and electrolytes every hour' : undefined,
    });
  }

  return {
    hourlySchedule: schedule,
    totalWaterLiters: Math.round((totalOz * 0.02957) * 10) / 10,
    totalElectrolyteDoses: electrolyteDoses,
  };
}

function getSegmentAtHour(hour: number, segments: ScheduledSegment[]): ScheduledSegment | null {
  let elapsed = 0;
  for (const seg of segments) {
    elapsed += seg.adjustedTimeMinutes / 60;
    if (hour < elapsed) return seg;
  }
  return segments[segments.length - 1] ?? null;
}

export function checkHyponatremiaRisk(
  hydrationLog: Array<{ timestamp: Date; waterOz: number; hadElectrolytes: boolean }>
): boolean {
  if (hydrationLog.length < 2) return false;
  // Count trailing consecutive entries without electrolytes
  let streak = 0;
  for (let i = hydrationLog.length - 1; i >= 0; i--) {
    if (!hydrationLog[i].hadElectrolytes) streak++;
    else break;
  }
  return streak >= 2;
}

export function getDefaultHourlyTemps(tripDate: Date): number[] {
  // Conservative default temp curve for inner gorge (no forecast)
  const month = tripDate.getMonth() + 1;
  let baseHigh = 90;
  if (month >= 6 && month <= 9) baseHigh = 110;
  else if (month >= 4 && month <= 5) baseHigh = 95;
  else if (month >= 10 && month <= 11) baseHigh = 80;
  else baseHigh = 65;

  // Build 30-hour curve: cold start, peak at hour 14, cool off
  return Array.from({ length: 30 }, (_, i) => {
    const factor = Math.sin((Math.PI * i) / 28);
    return Math.round(baseHigh * 0.6 + baseHigh * 0.4 * factor);
  });
}
