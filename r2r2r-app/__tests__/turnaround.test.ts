import { assessTurnaround, evaluateConditions, isNorthRimWaterOff } from '../src/lib/turnaround';
import { generateScheduledSegments, parseStartTime } from '../src/lib/pacing';
import type { TripPlan, Forecast, CheckIn } from '../src/lib/types';

function makeTrip(overrides: Partial<TripPlan> = {}): TripPlan {
  const tripDate = new Date('2025-06-01T00:00:00');
  const startTime = parseStartTime(tripDate, '04:00');
  const segments = generateScheduledSegments('STRONG', startTime, 'S_TO_N');
  const targetFinishTime = segments[segments.length - 1].plannedEndTime;
  return {
    id: 'test',
    createdAt: new Date(),
    tripDate,
    startTime: '04:00',
    direction: 'S_TO_N',
    fitnessLevel: 'STRONG',
    bodyWeightLbs: 160,
    targetFinishTime,
    status: 'IN_PROGRESS',
    scheduledSegments: segments,
    checkIns: [],
    hydrationLog: [],
    gearChecklist: [],
    ...overrides,
  };
}

function makeForecast(innerGorgeHighF: number): Forecast {
  return {
    innerGorgeHighF,
    hourlyTemps: Array(30).fill(innerGorgeHighF),
    summary: 'Test forecast',
    lastUpdated: new Date(),
  };
}

describe('assessTurnaround', () => {
  it('returns CONTINUE if on pace and temp < 100F', () => {
    const plan = makeTrip();
    const result = assessTurnaround([], plan, new Date(), makeForecast(85));
    expect(result.recommendation).toBe('CONTINUE');
  });

  it('returns CONSIDER_TURNING if cumulative delay > 90 minutes', () => {
    const plan = makeTrip();
    const checkIns: CheckIn[] = [
      {
        waypointId: 'ba_cg',
        actualTime: new Date(),
        plannedTime: new Date(),
        deltaMinutes: 95,
      },
    ];
    const result = assessTurnaround(checkIns, plan, new Date(), makeForecast(85));
    expect(result.recommendation).toBe('CONSIDER_TURNING');
  });

  it('returns TURN_BACK_NOW if cumulative delay exceeds 3 hours', () => {
    const plan = makeTrip();
    const checkIns: CheckIn[] = [
      { waypointId: 'ba_cg', actualTime: new Date(), plannedTime: new Date(), deltaMinutes: 181 },
    ];
    const result = assessTurnaround(checkIns, plan, new Date(), makeForecast(85));
    expect(result.recommendation).toBe('TURN_BACK_NOW');
  });

  it('returns TURN_BACK_NOW if outbound Phantom transit is projected after 2 PM', () => {
    const tripDate = new Date('2025-06-01T00:00:00');
    // Very late start: 11:30 AM — Phantom outbound at ~2:30 PM
    const lateStart = parseStartTime(tripDate, '11:30');
    const segments = generateScheduledSegments('STRONG', lateStart, 'S_TO_N');
    const plan = makeTrip({
      startTime: '11:30',
      scheduledSegments: segments,
      targetFinishTime: segments[segments.length - 1].plannedEndTime,
    });
    const result = assessTurnaround([], plan, new Date(), makeForecast(85));
    expect(result.recommendation).toBe('TURN_BACK_NOW');
  });

  it('minutesBehindPlan reflects cumulative delta', () => {
    const plan = makeTrip();
    const checkIns: CheckIn[] = [
      { waypointId: 'ba_cg', actualTime: new Date(), plannedTime: new Date(), deltaMinutes: 30 },
      { waypointId: 'phantom', actualTime: new Date(), plannedTime: new Date(), deltaMinutes: 20 },
    ];
    const result = assessTurnaround(checkIns, plan, new Date(), makeForecast(85));
    expect(result.minutesBehindPlan).toBe(50);
  });

  it('latestSafeTurnaroundTime is before the 2 PM phantom deadline', () => {
    const plan = makeTrip();
    const result = assessTurnaround([], plan, new Date(), makeForecast(85));
    const deadlineHour = result.latestSafeTurnaroundTime.getHours();
    expect(deadlineHour).toBeLessThanOrEqual(14);
  });
});

describe('evaluateConditions', () => {
  it('returns GO when temp < 100F and all water sources open', () => {
    const sources = [{ status: 'OPEN', critical: true, id: 'phantom' }];
    expect(evaluateConditions(makeForecast(90), sources, new Date('2025-07-01'))).toBe('GO');
  });

  it('returns CAUTION when 100 <= temp < 110', () => {
    const sources = [{ status: 'OPEN', critical: true, id: 'phantom' }];
    expect(evaluateConditions(makeForecast(105), sources, new Date('2025-07-01'))).toBe('CAUTION');
  });

  it('returns NO_GO when temp >= 110F', () => {
    const sources = [{ status: 'OPEN', critical: true, id: 'phantom' }];
    expect(evaluateConditions(makeForecast(110), sources, new Date('2025-07-01'))).toBe('NO_GO');
  });

  it('returns NO_GO if a critical water source is DOWN', () => {
    const sources = [{ status: 'DOWN', critical: true, id: 'phantom' }];
    expect(evaluateConditions(makeForecast(80), sources, new Date('2025-07-01'))).toBe('NO_GO');
  });

  it('returns GO if non-critical water source is DOWN', () => {
    const sources = [
      { status: 'DOWN', critical: false, id: 'ribbon_falls' },
      { status: 'OPEN', critical: true, id: 'phantom' },
    ];
    expect(evaluateConditions(makeForecast(80), sources, new Date('2025-07-01'))).toBe('GO');
  });
});

describe('isNorthRimWaterOff', () => {
  it('is off in December', () => {
    expect(isNorthRimWaterOff(new Date('2025-12-01'))).toBe(true);
  });
  it('is off in January', () => {
    expect(isNorthRimWaterOff(new Date('2025-01-15'))).toBe(true);
  });
  it('is off on October 15', () => {
    expect(isNorthRimWaterOff(new Date('2025-10-15'))).toBe(true);
  });
  it('is on in July', () => {
    expect(isNorthRimWaterOff(new Date('2025-07-04'))).toBe(false);
  });
  it('is on on May 16', () => {
    expect(isNorthRimWaterOff(new Date('2025-05-16'))).toBe(false);
  });
  it('is off on May 15', () => {
    expect(isNorthRimWaterOff(new Date('2025-05-15'))).toBe(true);
  });
});
