const RACE_DATE = new Date('2026-10-07');
const RACE_NAME = 'Rim to Rim to Rim (R2R2R)';

const RACE_PROFILE = {
  name: RACE_NAME,
  date: RACE_DATE,
  distanceMiles: 46,
  elevationGainFt: 11000,
  elevationLossFt: 11000,
  terrain: 'trail',
  description: 'Grand Canyon Rim-to-Rim-to-Rim: South Kaibab to North Rim and back via Bright Angel Trail',
};

// Training phases with target weekly mileage multipliers and focus areas
const PHASES = [
  { name: 'Base Building', weeksOut: [16, Infinity], mileagePct: 0.5, focus: 'aerobic base, easy miles, consistency', longRunPct: 0.25 },
  { name: 'Build Phase 1', weeksOut: [12, 16], mileagePct: 0.65, focus: 'increasing volume, tempo runs, hill work', longRunPct: 0.28 },
  { name: 'Build Phase 2', weeksOut: [8, 12], mileagePct: 0.8, focus: 'peak volume, back-to-back long runs, vert training', longRunPct: 0.30 },
  { name: 'Peak', weeksOut: [4, 8], mileagePct: 1.0, focus: 'race-specific efforts, longest runs, heat/altitude training', longRunPct: 0.35 },
  { name: 'Taper', weeksOut: [1, 4], mileagePct: 0.6, focus: 'reduced volume, maintain intensity, rest and recovery', longRunPct: 0.30 },
  { name: 'Race Week', weeksOut: [0, 1], mileagePct: 0.25, focus: 'shakeout runs only, rest, visualization, gear check', longRunPct: 0 },
];

const WORKOUT_TYPES = {
  easy: { name: 'Easy Run', hrZone: '1-2', effort: 'conversational', description: 'Relaxed pace, building aerobic base' },
  long: { name: 'Long Run', hrZone: '1-2', effort: 'easy to moderate', description: 'Sustained effort building endurance' },
  tempo: { name: 'Tempo Run', hrZone: '3', effort: 'comfortably hard', description: 'Sustained effort at lactate threshold' },
  intervals: { name: 'Interval Training', hrZone: '4-5', effort: 'hard', description: 'Repeated hard efforts with recovery' },
  hills: { name: 'Hill Repeats', hrZone: '3-4', effort: 'hard on climbs', description: 'Repeated hill efforts for climbing strength' },
  trail: { name: 'Trail Run', hrZone: '1-3', effort: 'variable', description: 'Technical trail running on varied terrain' },
  backToBack: { name: 'Back-to-Back Long', hrZone: '1-2', effort: 'moderate', description: 'Long run on tired legs from previous day' },
  recovery: { name: 'Recovery Run', hrZone: '1', effort: 'very easy', description: 'Short, very easy jog for active recovery' },
  rest: { name: 'Rest Day', hrZone: 'N/A', effort: 'none', description: 'Complete rest or gentle walking/stretching' },
  cross: { name: 'Cross Training', hrZone: '1-2', effort: 'easy to moderate', description: 'Cycling, swimming, yoga, or strength work' },
  vert: { name: 'Vertical Training', hrZone: '2-3', effort: 'moderate', description: 'Stair climbing, steep hiking, or incline treadmill for elevation prep' },
  heatAcclim: { name: 'Heat Acclimation Run', hrZone: '1-2', effort: 'easy', description: 'Run in warmest part of day to prepare for canyon heat' },
};

// Weekly template by day-of-week (0=Sun, 6=Sat)
const WEEK_TEMPLATES = {
  'Base Building': ['long', 'rest', 'easy', 'cross', 'easy', 'rest', 'trail'],
  'Build Phase 1': ['long', 'rest', 'easy', 'tempo', 'easy', 'rest', 'hills'],
  'Build Phase 2': ['long', 'recovery', 'easy', 'tempo', 'hills', 'rest', 'backToBack'],
  'Peak': ['long', 'recovery', 'vert', 'tempo', 'heatAcclim', 'rest', 'backToBack'],
  'Taper': ['long', 'rest', 'easy', 'tempo', 'rest', 'rest', 'easy'],
  'Race Week': ['easy', 'rest', 'recovery', 'rest', 'rest', 'rest', 'rest'],
};

function getWeeksUntilRace(fromDate = new Date()) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, (RACE_DATE - fromDate) / msPerWeek);
}

function getDaysUntilRace(fromDate = new Date()) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((RACE_DATE - fromDate) / msPerDay));
}

function getCurrentPhase(fromDate = new Date()) {
  const weeksOut = getWeeksUntilRace(fromDate);
  return PHASES.find(p => weeksOut >= p.weeksOut[0] && weeksOut < p.weeksOut[1]) || PHASES[PHASES.length - 1];
}

function analyzeRecentTraining(activities) {
  if (!activities || activities.length === 0) {
    return { weeklyMiles: 0, weeklyElevation: 0, avgPace: 0, runCount: 0, restDays: 7, longestRun: 0, totalTime: 0, fatigueScore: 0 };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const runs = activities.filter(a => a.type === 'Run' || a.type === 'Trail Run' || a.type === 'TrailRun');
  const thisWeekRuns = runs.filter(a => new Date(a.start_date) >= oneWeekAgo);
  const lastWeekRuns = runs.filter(a => new Date(a.start_date) >= twoWeeksAgo && new Date(a.start_date) < oneWeekAgo);

  const metersToMiles = m => m * 0.000621371;
  const metersToFeet = m => m * 3.28084;

  const weeklyMiles = thisWeekRuns.reduce((sum, a) => sum + metersToMiles(a.distance), 0);
  const lastWeekMiles = lastWeekRuns.reduce((sum, a) => sum + metersToMiles(a.distance), 0);
  const weeklyElevation = thisWeekRuns.reduce((sum, a) => sum + metersToFeet(a.total_elevation_gain || 0), 0);
  const totalTime = thisWeekRuns.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const longestRun = Math.max(0, ...thisWeekRuns.map(a => metersToMiles(a.distance)));

  const runDays = new Set(thisWeekRuns.map(a => new Date(a.start_date).toDateString())).size;
  const restDays = 7 - runDays;

  let avgPace = 0;
  if (totalTime > 0 && weeklyMiles > 0) {
    avgPace = (totalTime / 60) / weeklyMiles; // min/mile
  }

  // Fatigue score: 0-100, higher = more fatigued
  const volumeJump = lastWeekMiles > 0 ? (weeklyMiles - lastWeekMiles) / lastWeekMiles : 0;
  const fatigueScore = Math.min(100, Math.max(0,
    (runDays >= 6 ? 30 : runDays * 5) +
    (volumeJump > 0.15 ? 25 : volumeJump * 100) +
    (restDays <= 1 ? 20 : 0) +
    (weeklyMiles > 50 ? 15 : weeklyMiles / 50 * 15)
  ));

  return {
    weeklyMiles: Math.round(weeklyMiles * 10) / 10,
    lastWeekMiles: Math.round(lastWeekMiles * 10) / 10,
    weeklyElevation: Math.round(weeklyElevation),
    avgPace: Math.round(avgPace * 100) / 100,
    runCount: thisWeekRuns.length,
    restDays,
    longestRun: Math.round(longestRun * 10) / 10,
    totalTime: Math.round(totalTime / 60),
    fatigueScore: Math.round(fatigueScore),
  };
}

function estimateTargetWeeklyMileage(currentFitness) {
  const baseMileage = Math.max(20, currentFitness.weeklyMiles || 20);
  return Math.min(65, baseMileage * 1.1); // 10% rule, cap at 65mpw for R2R2R
}

function generateRecommendation(activities, targetDate = new Date()) {
  const phase = getCurrentPhase(targetDate);
  const weeksOut = getWeeksUntilRace(targetDate);
  const daysOut = getDaysUntilRace(targetDate);
  const stats = analyzeRecentTraining(activities);
  const targetMileage = estimateTargetWeeklyMileage(stats);

  const dayOfWeek = targetDate.getDay();
  const template = WEEK_TEMPLATES[phase.name] || WEEK_TEMPLATES['Base Building'];
  let workoutKey = template[dayOfWeek];

  // Adjust based on fatigue
  if (stats.fatigueScore > 70 && workoutKey !== 'rest') {
    if (['tempo', 'intervals', 'hills', 'backToBack'].includes(workoutKey)) {
      workoutKey = 'easy';
    } else if (workoutKey === 'easy') {
      workoutKey = 'recovery';
    }
  }

  // Adjust based on rest days
  if (stats.restDays <= 1 && workoutKey !== 'rest' && workoutKey !== 'recovery') {
    workoutKey = 'rest';
  }

  const workout = WORKOUT_TYPES[workoutKey];
  const phaseMileage = targetMileage * phase.mileagePct;

  // Calculate suggested distance
  let suggestedMiles = 0;
  if (workoutKey === 'rest') {
    suggestedMiles = 0;
  } else if (workoutKey === 'long' || workoutKey === 'backToBack') {
    suggestedMiles = Math.round(phaseMileage * phase.longRunPct * 10) / 10;
    if (phase.name === 'Peak') suggestedMiles = Math.min(suggestedMiles, 28);
  } else if (workoutKey === 'recovery') {
    suggestedMiles = Math.min(4, phaseMileage * 0.08);
  } else if (workoutKey === 'cross') {
    suggestedMiles = 0;
  } else {
    suggestedMiles = Math.round(phaseMileage / 5 * 10) / 10; // ~1/5 of weekly target for regular runs
  }

  // Suggested elevation for vert-focused workouts
  let suggestedElevation = 0;
  if (['hills', 'vert', 'trail'].includes(workoutKey)) {
    suggestedElevation = Math.round(phase.mileagePct * 2000); // up to 2000ft on peak vert days
  } else if (workoutKey === 'long' && weeksOut < 10) {
    suggestedElevation = Math.round(phase.mileagePct * 1500);
  }

  const dateStr = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let message = `${dateStr} - ${workout.name}\n`;
  message += `\nTraining Phase: ${phase.name} (${daysOut} days to R2R2R)\n`;

  if (suggestedMiles > 0) {
    message += `Distance: ${suggestedMiles} miles\n`;
  }
  if (suggestedElevation > 0) {
    message += `Target Elevation: ${suggestedElevation}+ ft gain\n`;
  }
  message += `Effort: ${workout.effort} (HR Zone ${workout.hrZone})\n`;
  message += `\n${workout.description}`;

  // Add phase-specific tips
  if (phase.name === 'Peak' && ['long', 'backToBack'].includes(workoutKey)) {
    message += '\n\nTip: Practice your race-day nutrition and hydration strategy on this run. Simulate canyon conditions if possible -- seek out heat and elevation.';
  } else if (phase.name === 'Taper') {
    message += '\n\nTip: Trust your training. Keep runs easy and focus on sleep, nutrition, and mental preparation.';
  } else if (phase.name === 'Race Week') {
    message += '\n\nTip: Finalize gear, review the route, and stay off your feet. Hydrate well and eat clean.';
  } else if (workoutKey === 'vert') {
    message += '\n\nTip: The R2R2R has ~11,000ft of climbing. Use stairs, steep trails, or incline treadmill to build climbing strength.';
  } else if (workoutKey === 'heatAcclim') {
    message += '\n\nTip: Inner canyon temps can exceed 110F. Run during the hottest part of the day to build heat tolerance. Stay safe -- carry extra water.';
  }

  if (stats.fatigueScore > 70) {
    message += '\n\n⚠ Your fatigue score is elevated. This workout has been adjusted to prioritize recovery.';
  }

  // Weekly summary context
  message += `\n\nThis Week: ${stats.weeklyMiles}mi / ${stats.runCount} runs / ${stats.weeklyElevation}ft vert`;
  if (stats.lastWeekMiles > 0) {
    const pctChange = Math.round(((stats.weeklyMiles - stats.lastWeekMiles) / stats.lastWeekMiles) * 100);
    message += ` (${pctChange >= 0 ? '+' : ''}${pctChange}% vs last week)`;
  }

  return {
    date: targetDate.toISOString().split('T')[0],
    phase: phase.name,
    daysUntilRace: daysOut,
    workoutType: workoutKey,
    workout,
    suggestedMiles,
    suggestedElevation,
    stats,
    message,
    race: RACE_PROFILE,
  };
}

function getTrainingOverview(activities) {
  const now = new Date();
  const phase = getCurrentPhase(now);
  const stats = analyzeRecentTraining(activities);
  const daysOut = getDaysUntilRace(now);
  const weeksOut = Math.round(getWeeksUntilRace(now) * 10) / 10;

  // Generate next 7 days of recommendations
  const upcoming = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    upcoming.push(generateRecommendation(activities, d));
  }

  return {
    race: RACE_PROFILE,
    daysUntilRace: daysOut,
    weeksUntilRace: weeksOut,
    currentPhase: phase,
    currentStats: stats,
    targetWeeklyMileage: estimateTargetWeeklyMileage(stats),
    upcoming,
  };
}

module.exports = {
  RACE_PROFILE,
  getCurrentPhase,
  analyzeRecentTraining,
  generateRecommendation,
  getTrainingOverview,
  getDaysUntilRace,
  getWeeksUntilRace,
};
