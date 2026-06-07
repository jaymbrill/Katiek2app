import { generateHydrationPlan, checkHyponatremiaRisk } from '../src/lib/hydration';
import { generateScheduledSegments, parseStartTime } from '../src/lib/pacing';

function makeSegments() {
  const start = parseStartTime(new Date('2025-07-01'), '04:00');
  return generateScheduledSegments('STRONG', start, 'S_TO_N');
}

describe('generateHydrationPlan', () => {
  it('never recommends > 32 oz/hour (hyponatremia guard)', () => {
    const segments = makeSegments();
    const temps = Array(30).fill(115); // extreme heat
    const plan = generateHydrationPlan(160, segments, temps);
    for (const hour of plan.hourlySchedule) {
      expect(hour.waterOz).toBeLessThanOrEqual(32);
    }
  });

  it('recommends electrolytes every hour above 100F inner gorge temp', () => {
    const segments = makeSegments();
    const temps = Array(30).fill(105);
    const plan = generateHydrationPlan(160, segments, temps);
    for (const hour of plan.hourlySchedule) {
      expect(hour.electrolytes).toBe(true);
    }
  });

  it('produces more water oz at 100F than at 70F', () => {
    const segments = makeSegments();
    const hotTemps = Array(30).fill(100);
    const coolTemps = Array(30).fill(70);
    const hotPlan = generateHydrationPlan(160, segments, hotTemps);
    const coolPlan = generateHydrationPlan(160, segments, coolTemps);
    const avgHot = hotPlan.hourlySchedule.reduce((s, h) => s + h.waterOz, 0) / hotPlan.hourlySchedule.length;
    const avgCool = coolPlan.hourlySchedule.reduce((s, h) => s + h.waterOz, 0) / coolPlan.hourlySchedule.length;
    expect(avgHot).toBeGreaterThan(avgCool);
  });

  it('returns empty plan for empty segments', () => {
    const plan = generateHydrationPlan(160, [], []);
    expect(plan.hourlySchedule).toHaveLength(0);
    expect(plan.totalWaterLiters).toBe(0);
  });
});

describe('checkHyponatremiaRisk', () => {
  it('returns false when log is empty', () => {
    expect(checkHyponatremiaRisk([])).toBe(false);
  });

  it('returns false with single entry', () => {
    const log = [{ timestamp: new Date(), waterOz: 16, hadElectrolytes: false }];
    expect(checkHyponatremiaRisk(log)).toBe(false);
  });

  it('returns true with 2+ consecutive entries without electrolytes', () => {
    const log = [
      { timestamp: new Date(), waterOz: 16, hadElectrolytes: false },
      { timestamp: new Date(), waterOz: 16, hadElectrolytes: false },
    ];
    expect(checkHyponatremiaRisk(log)).toBe(true);
  });

  it('returns false when electrolytes were taken in recent entries', () => {
    const log = [
      { timestamp: new Date(), waterOz: 16, hadElectrolytes: false },
      { timestamp: new Date(), waterOz: 16, hadElectrolytes: true },
      { timestamp: new Date(), waterOz: 16, hadElectrolytes: false },
    ];
    expect(checkHyponatremiaRisk(log)).toBe(false);
  });
});
