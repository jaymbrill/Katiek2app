const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

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

function getActivePrefs() {
  const prefs = loadPrefs();
  prefs.limitations = prefs.limitations.filter(l => {
    const age = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24);
    return age < 14;
  });
  return prefs;
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

const TOOLS = [
  {
    name: 'set_long_run_days',
    description: 'Set which days of the week the user prefers for long runs. Call this when the user mentions preferred days for long runs or back-to-back runs.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          items: { type: 'string', enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
          description: 'Days of the week for long runs',
        },
      },
      required: ['days'],
    },
  },
  {
    name: 'set_max_long_run',
    description: 'Set or clear the maximum long run distance in miles. Call this when the user mentions a cap or limit on long run distance.',
    input_schema: {
      type: 'object',
      properties: {
        miles: { type: ['integer', 'null'], description: 'Max long run miles, or null to remove the cap' },
      },
      required: ['miles'],
    },
  },
  {
    name: 'set_preferred_time',
    description: 'Set or clear the user\'s preferred time of day for running.',
    input_schema: {
      type: 'object',
      properties: {
        time: { type: ['string', 'null'], enum: ['morning', 'evening', null], description: 'Preferred time, or null to clear' },
      },
      required: ['time'],
    },
  },
  {
    name: 'add_limitation',
    description: 'Record a physical limitation, injury, fatigue, or schedule constraint that should affect training recommendations.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Description of the limitation as the user stated it' },
        category: { type: 'string', enum: ['injury', 'fatigue', 'schedule'], description: 'Category of limitation' },
      },
      required: ['text', 'category'],
    },
  },
  {
    name: 'clear_limitations',
    description: 'Clear all active limitations. Call when the user says they are feeling good, healthy, recovered, or no longer have issues.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'reset_all_preferences',
    description: 'Reset all preferences to defaults. Only call when the user explicitly asks to reset or clear everything.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_current_status',
    description: 'Get the user\'s current training preferences and settings. Call when the user asks for their status, settings, or current preferences.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

function executeTool(name, input, prefs) {
  switch (name) {
    case 'set_long_run_days':
      prefs.longRunDays = input.days;
      savePrefs(prefs);
      return `Long run days updated to: ${input.days.join(', ')}`;

    case 'set_max_long_run':
      prefs.maxLongRunMiles = input.miles;
      savePrefs(prefs);
      return input.miles ? `Max long run set to ${input.miles} miles` : 'Max long run cap removed (auto)';

    case 'set_preferred_time':
      prefs.preferredTimeOfDay = input.time;
      savePrefs(prefs);
      return input.time ? `Preferred time set to ${input.time}` : 'Time preference cleared';

    case 'add_limitation': {
      prefs.limitations = prefs.limitations.filter(l => {
        const age = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24);
        return age < 14;
      });
      prefs.limitations.push({
        text: input.text,
        keywords: [input.category],
        date: new Date().toISOString().split('T')[0],
      });
      savePrefs(prefs);
      return `Limitation recorded: "${input.text}" (${input.category}). Will auto-expire in 14 days.`;
    }

    case 'clear_limitations':
      prefs.limitations = [];
      savePrefs(prefs);
      return 'All limitations cleared.';

    case 'reset_all_preferences': {
      const fresh = { ...DEFAULT_PREFS };
      savePrefs(fresh);
      Object.assign(prefs, fresh);
      return 'All preferences reset to defaults.';
    }

    case 'get_current_status':
      return formatStatus(prefs);

    default:
      return 'Unknown tool';
  }
}

function buildSystemPrompt(prefs) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const raceDate = new Date('2026-10-07');
  const daysOut = Math.max(0, Math.ceil((raceDate - new Date()) / (1000 * 60 * 60 * 24)));

  return `You are the R2R2R Training Bot — a friendly, knowledgeable running coach helping a runner prepare for the Rim-to-Rim-to-Rim (R2R2R) ultrarun in the Grand Canyon on October 7, 2026.

Today is ${today}. There are ${daysOut} days until race day.

The R2R2R is 46 miles with 11,000ft of elevation gain/loss through the Grand Canyon, from the South Rim via South Kaibab Trail to the North Rim and back via Bright Angel Trail.

CURRENT USER PREFERENCES:
- Long run days: ${prefs.longRunDays.join(', ')}
- Max long run: ${prefs.maxLongRunMiles ? prefs.maxLongRunMiles + ' miles' : 'auto (no cap)'}
- Preferred time: ${prefs.preferredTimeOfDay || 'no preference'}
- Active limitations: ${prefs.limitations.length > 0 ? prefs.limitations.map(l => l.text).join('; ') : 'none'}

INSTRUCTIONS:
- You respond via SMS, so keep responses SHORT (under 320 characters ideally, never over 480).
- Be warm, encouraging, and coaching-like. Use the runner's context.
- When the user wants to change preferences, use the appropriate tool. You can call multiple tools in one turn.
- When the user reports an injury, pain, soreness, tightness, or physical issue, use add_limitation with category "injury".
- When the user reports fatigue, exhaustion, or overtraining, use add_limitation with category "fatigue".
- When the user mentions travel, work, vacation, or schedule conflicts, use add_limitation with category "schedule".
- When the user says they feel good, are recovered, or have no issues, use clear_limitations.
- If the user asks about their settings or status, use get_current_status and include the info in your response.
- For general training questions, answer directly with coaching advice relevant to R2R2R prep.
- Don't use emojis excessively — one or two max per message.
- After making preference changes, briefly confirm what changed in your response.`;
}

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic();
  }
  return client;
}

async function processInboundMessage(body) {
  const prefs = loadPrefs();
  const text = (body || '').trim();

  if (!text) {
    return { response: 'Hey! Text me your training preferences or questions. Try things like "long runs on Saturdays" or "knee is sore" or just ask me anything about R2R2R training!', prefs };
  }

  const anthropic = getClient();
  if (!anthropic) {
    return processInboundMessageFallback(body, prefs);
  }

  try {
    const messages = [{ role: 'user', content: text }];
    let response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system: buildSystemPrompt(prefs),
      tools: TOOLS,
      messages,
    });

    while (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = toolBlocks.map(block => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: executeTool(block.name, block.input, prefs),
      }));

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 300,
        system: buildSystemPrompt(prefs),
        tools: TOOLS,
        messages,
      });
    }

    const textBlock = response.content.find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text : 'Got it! Your preferences have been updated.';

    return { response: reply, prefs: loadPrefs() };
  } catch (err) {
    console.error('[SMS] Claude API error:', err.message);
    return processInboundMessageFallback(body, prefs);
  }
}

function processInboundMessageFallback(body, prefs) {
  const text = (body || '').trim();
  const lower = text.toLowerCase();

  if (lower === 'status' || lower === 'settings' || lower === 'prefs') {
    return { response: formatStatus(prefs), prefs };
  }

  if (lower === 'help' || lower === '?') {
    return {
      response: 'R2R2R Training Bot:\n- "Long runs on Sat/Sun"\n- "Knee is sore"\n- "Max 18 miles"\n- "Prefer mornings"\n- "Feeling good" to clear limitations\n- "STATUS" for settings',
      prefs,
    };
  }

  if (lower === 'reset' || lower === 'clear all') {
    const fresh = { ...DEFAULT_PREFS };
    savePrefs(fresh);
    return { response: 'All preferences cleared. Send new ones anytime!', prefs: fresh };
  }

  if (lower.includes('feeling good') || lower.includes('feel good') || lower.includes('all good') || lower.includes('healthy')) {
    prefs.limitations = [];
    savePrefs(prefs);
    return { response: 'Great to hear! Cleared all limitations. Full training ahead.', prefs };
  }

  prefs.notes.push({ text, date: new Date().toISOString().split('T')[0] });
  if (prefs.notes.length > 10) prefs.notes = prefs.notes.slice(-10);
  savePrefs(prefs);
  return { response: `Noted! I'll factor that in. (AI coaching unavailable — set ANTHROPIC_API_KEY for smarter responses.)`, prefs };
}

module.exports = { processInboundMessage, getActivePrefs, loadPrefs, savePrefs, DEFAULT_PREFS };
