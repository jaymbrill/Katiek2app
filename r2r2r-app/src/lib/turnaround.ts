import type {
  CheckIn,
  TripPlan,
  TurnaroundAssessment,
  Forecast,
} from './types';

const FATIGUE_MULTIPLIER = 1.15;
// >90 min behind → strongly consider turning
const DELAY_CAUTION_MINUTES = 90;
// >3 hours behind → turn back now (fatigue compounds, no safe finish)
const DELAY_CRITICAL_MINUTES = 180;
// If projected finish is >6 hours over planned, abort
const OVERRUN_CRITICAL_MINUTES = 360;
// Must be past Phantom Ranch (outbound) before this hour to avoid peak inner-gorge heat
const OUTBOUND_PHANTOM_DEADLINE_HOUR = 14;

export function assessTurnaround(
  checkIns: CheckIn[],
  plan: TripPlan,
  currentTime: Date,
  forecast: Forecast
): TurnaroundAssessment {
  const cumulativeDelayMin = checkIns.reduce((sum, c) => sum + c.deltaMinutes, 0);

  const projectedFinish = addMinutes(
    plan.targetFinishTime,
    cumulativeDelayMin * FATIGUE_MULTIPLIER
  );

  const latestSafeTurnaroundTime = calculateLatestSafeTurnaround(plan);

  // Check if outbound Phantom transit will be in peak heat (>2 PM)
  const projectedPhantomOutbound = calculatePhantomOutboundTime(checkIns, plan);
  const phantomOutboundDeadline = setTimeOnDate(plan.tripDate, OUTBOUND_PHANTOM_DEADLINE_HOUR, 0);
  const phantomHeatDanger = projectedPhantomOutbound > phantomOutboundDeadline;

  const overrunMin = (projectedFinish.getTime() - plan.targetFinishTime.getTime()) / 60000;

  if (phantomHeatDanger || cumulativeDelayMin > DELAY_CRITICAL_MINUTES || overrunMin > OVERRUN_CRITICAL_MINUTES) {
    const reason = phantomHeatDanger
      ? `You are projected to reach Phantom Ranch at ${formatTime(projectedPhantomOutbound)}, during peak Inner Gorge heat. Turn back to avoid life-threatening temperatures.`
      : `You are ${cumulativeDelayMin} minutes behind plan with a projected finish of ${formatTime(projectedFinish)}. Fatigue and heat make completion unsafe.`;
    return {
      recommendation: 'TURN_BACK_NOW',
      reasoning: reason,
      estimatedFinishTime: projectedFinish,
      latestSafeTurnaroundTime,
      minutesBehindPlan: cumulativeDelayMin,
    };
  }

  if (cumulativeDelayMin > DELAY_CAUTION_MINUTES) {
    return {
      recommendation: 'CONSIDER_TURNING',
      reasoning: `You are ${cumulativeDelayMin} minutes behind your plan. Fatigue typically increases pace loss — your projected finish is ${formatTime(projectedFinish)}. Strongly consider turning back now.`,
      estimatedFinishTime: projectedFinish,
      latestSafeTurnaroundTime,
      minutesBehindPlan: cumulativeDelayMin,
    };
  }

  return {
    recommendation: 'CONTINUE',
    reasoning: `You are on pace. Projected finish: ${formatTime(projectedFinish)}. Latest safe turnaround: ${formatTime(latestSafeTurnaroundTime)}.`,
    estimatedFinishTime: projectedFinish,
    latestSafeTurnaroundTime,
    minutesBehindPlan: cumulativeDelayMin,
  };
}

export function evaluateConditions(
  forecast: Forecast,
  waterSources: Array<{ status: string; critical: boolean }>,
  tripDate: Date
): 'GO' | 'CAUTION' | 'NO_GO' {
  const criticalWaterDown = waterSources.some(
    (s) => s.status === 'DOWN' && s.critical
  );
  if (criticalWaterDown) return 'NO_GO';

  // North Rim water off Oct 15 – May 15
  const northRimSeasonal = waterSources.find((s) => (s as any).id === 'north_rim');
  if (northRimSeasonal && isNorthRimWaterOff(tripDate)) return 'NO_GO';

  if (forecast.innerGorgeHighF >= 110) return 'NO_GO';
  if (forecast.innerGorgeHighF >= 100) return 'CAUTION';
  return 'GO';
}

export function isNorthRimWaterOff(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // Off: Oct 15 – May 15
  if (month > 10 || month < 5) return true;
  if (month === 10 && day >= 15) return true;
  if (month === 5 && day <= 15) return true;
  return false;
}

function calculatePhantomOutboundTime(checkIns: CheckIn[], plan: TripPlan): Date {
  // Outbound Phantom = end of second segment (BA CG → Phantom Ranch)
  const outboundSeg = plan.scheduledSegments.find((s) => s.id === 'ba_cg_to_phantom');
  if (!outboundSeg) return plan.targetFinishTime;
  const delay = checkIns.reduce((sum, c) => sum + c.deltaMinutes, 0);
  return addMinutes(outboundSeg.plannedEndTime, delay * FATIGUE_MULTIPLIER);
}

function calculateLatestSafeTurnaround(plan: TripPlan): Date {
  // Latest safe turnaround = outbound phantom deadline minus North Rim leg time
  const phantomDeadline = setTimeOnDate(plan.tripDate, OUTBOUND_PHANTOM_DEADLINE_HOUR, 0);
  const northRimLegs = plan.scheduledSegments.filter(
    (s) => s.id === 'phantom_to_cottonwood' || s.id === 'cottonwood_to_north_rim'
  );
  const outboundToNorthRimMin = northRimLegs.reduce((sum, s) => sum + s.adjustedTimeMinutes, 0);
  return addMinutes(phantomDeadline, -outboundToNorthRimMin);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
