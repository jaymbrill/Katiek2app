const fs = require('fs');
const path = require('path');

const PREFS_PATH = path.join(__dirname, '..', '.user-prefs.json');

const DEFAULT_PREFS = {
  longRunDays: ['Saturday', 'Sunday'],
  limitations: [],
  maxLongRunMiles: null,
  preferredTimeOfDay: null,
  notes: [],
  lastUpdated: null,
};

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(fs.readFileSync(PREFS_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  prefs.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2));
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBREVS = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', tues: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', fri: 'Friday', sat: 'Saturday' };

function parseDays(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [abbr, full] of Object.entries(DAY_ABBREVS)) {
    if (lower.includes(abbr)) found.push(full);
  }
  for (const day of DAY_NAMES) {
    const capitalized = day.charAt(0).toUpperCase() + day.slice(1);
    if (lower.includes(day) && !found.includes(capitalized)) found.push(capitalized);
  }
  return [...new Set(found)];
}

const LIMITATION_KEYWORDS = [
  'knee', 'ankle', 'hip', 'shin', 'hamstring', 'calf', 'achilles', 'plantar',
  'it band', 'itb', 'back', 'foot', 'feet', 'sore', 'pain', 'injury', 'injured',
  'tight', 'stiff', 'swollen', 'tender', 'hurts', 'ache', 'strain', 'sprain',
  'tired', 'exhausted', 'fatigued', 'burned out', 'overtrained',
  'travel', 'traveling', 'trip', 'vacation', 'busy', 'work',
];

function processInboundMessage(body) {
  const prefs = loadPrefs();
  const text = (body || '').trim();
  const lower = text.toLowerCase();

  if (!text) return { response: 'Send me your preferences! Try:\n- "Long runs on Saturdays"\n- "Knee is sore"\n- "Max 20 miles for long runs"\n- "Prefer mornings"\n- "STATUS" for current settings', prefs };

  // Status check
  if (lower === 'status' || lower === 'settings' || lower === 'prefs') {
    return { response: formatStatus(prefs), prefs };
  }

  // Help
  if (lower === 'help' || lower === '?') {
    return {
      response: 'R2R2R Training Bot commands:\n' +
        '- "Long runs on Sat/Sun"\n' +
        '- "Knee is sore" or "hip is tight"\n' +
        '- "Max 18 miles" for long run cap\n' +
        '- "Prefer mornings/evenings"\n' +
        '- "Feeling good" to clear limitations\n' +
        '- "Reset" to clear all preferences\n' +
        '- "STATUS" to see current settings',
      prefs,
    };
  }

  // Reset
  if (lower === 'reset' || lower === 'clear all') {
    const fresh = { ...DEFAULT_PREFS };
    savePrefs(fresh);
    return { response: 'All preferences cleared. Send new ones anytime!', prefs: fresh };
  }

  // Feeling good / clear limitations
  if (lower.includes('feeling good') || lower.includes('feel good') || lower.includes('all good') || lower.includes('no issues') || lower.includes('healthy')) {
    prefs.limitations = [];
    savePrefs(prefs);
    return { response: 'Great to hear! Cleared all limitations. Full training ahead.', prefs };
  }

  const responses = [];

  // Long run day preferences
  const days = parseDays(text);
  if (days.length > 0 && (lower.includes('long') || lower.includes('prefer') || lower.includes('best') || lower.includes('good for'))) {
    prefs.longRunDays = days;
    savePrefs(prefs);
    responses.push(`Long runs set to: ${days.join(', ')}`);
  } else if (days.length > 0 && !LIMITATION_KEYWORDS.some(k => lower.includes(k))) {
    prefs.longRunDays = days;
    savePrefs(prefs);
    responses.push(`Long run days updated to: ${days.join(', ')}`);
  }

  // Max long run distance
  const maxMatch = lower.match(/max\s*(\d+)\s*(mi|mile|miles)?/);
  if (maxMatch) {
    prefs.maxLongRunMiles = parseInt(maxMatch[1], 10);
    savePrefs(prefs);
    responses.push(`Max long run set to ${prefs.maxLongRunMiles} miles`);
  }

  // Time of day preference
  if (lower.includes('morning') || lower.includes('early') || lower.includes('am run')) {
    prefs.preferredTimeOfDay = 'morning';
    savePrefs(prefs);
    responses.push('Noted: morning runs preferred');
  } else if (lower.includes('evening') || lower.includes('afternoon') || lower.includes('pm run') || lower.includes('after work')) {
    prefs.preferredTimeOfDay = 'evening';
    savePrefs(prefs);
    responses.push('Noted: evening runs preferred');
  }

  // Limitations / injuries
  const foundLimitations = LIMITATION_KEYWORDS.filter(k => lower.includes(k));
  if (foundLimitations.length > 0) {
    const limitation = {
      text: text,
      keywords: foundLimitations,
      date: new Date().toISOString().split('T')[0],
    };
    prefs.limitations = prefs.limitations.filter(l => {
      const age = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24);
      return age < 14;
    });
    prefs.limitations.push(limitation);
    savePrefs(prefs);

    const isInjury = ['pain', 'injury', 'injured', 'strain', 'sprain', 'swollen'].some(k => lower.includes(k));
    if (isInjury) {
      responses.push(`Noted: "${text}". I'll reduce intensity and avoid aggravating workouts. Text "feeling good" when you're better.`);
    } else if (['tired', 'exhausted', 'fatigued', 'burned out', 'overtrained'].some(k => lower.includes(k))) {
      responses.push(`Got it -- you're fatigued. I'll dial back volume and add extra rest. Recovery is training too.`);
    } else if (['travel', 'traveling', 'trip', 'vacation', 'busy', 'work'].some(k => lower.includes(k))) {
      responses.push(`Noted: schedule constraint. I'll adjust workouts to be more flexible this period.`);
    } else {
      responses.push(`Noted: ${foundLimitations.join(', ')} issue. Workouts will be adjusted. Text "feeling good" to clear.`);
    }
  }

  // General notes
  if (responses.length === 0) {
    prefs.notes.push({ text, date: new Date().toISOString().split('T')[0] });
    if (prefs.notes.length > 10) prefs.notes = prefs.notes.slice(-10);
    savePrefs(prefs);
    responses.push(`Noted! I'll factor that in. Text HELP for available commands.`);
  }

  return { response: responses.join('\n'), prefs };
}

function formatStatus(prefs) {
  const lines = ['Current Settings:'];
  lines.push(`Long run days: ${prefs.longRunDays.join(', ')}`);
  if (prefs.maxLongRunMiles) lines.push(`Max long run: ${prefs.maxLongRunMiles} mi`);
  if (prefs.preferredTimeOfDay) lines.push(`Preferred time: ${prefs.preferredTimeOfDay}`);
  if (prefs.limitations.length > 0) {
    lines.push(`Active limitations: ${prefs.limitations.map(l => l.text).join('; ')}`);
  } else {
    lines.push('No active limitations');
  }
  if (prefs.lastUpdated) lines.push(`Last updated: ${new Date(prefs.lastUpdated).toLocaleDateString()}`);
  return lines.join('\n');
}

function getActivePrefs() {
  const prefs = loadPrefs();
  // Clean up old limitations (>14 days)
  prefs.limitations = prefs.limitations.filter(l => {
    const age = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24);
    return age < 14;
  });
  return prefs;
}

module.exports = { processInboundMessage, getActivePrefs, loadPrefs, savePrefs, DEFAULT_PREFS };
