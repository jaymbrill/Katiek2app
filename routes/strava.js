const express = require('express');
const router = express.Router();
const strava = require('../services/strava');
const training = require('../services/training');
const scheduler = require('../services/scheduler');
const notifications = require('../services/notifications');
const conversations = require('../services/conversations');

// --- Strava OAuth & Data ---

router.get('/status', (req, res) => {
  res.json({
    connected: strava.isConnected(),
    athlete: strava.getAthleteInfo(),
    notificationsConfigured: notifications.isConfigured(),
    race: training.RACE_PROFILE,
    daysUntilRace: training.getDaysUntilRace(),
  });
});

router.get('/auth', (req, res) => {
  try {
    const url = strava.getAuthUrl();
    res.json({ url });
  } catch {
    res.status(500).json({ error: 'Failed to generate auth URL. Check STRAVA_CLIENT_ID config.' });
  }
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?strava=error&msg=' + encodeURIComponent(error));
  try {
    await strava.exchangeCode(code);
    res.redirect('/?strava=connected');
  } catch (err) {
    res.redirect('/?strava=error&msg=' + encodeURIComponent(err.message));
  }
});

router.get('/activities', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '14', 10);
    const activities = await strava.getRecentActivities(days);
    res.json(activities);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/recommendation', async (req, res) => {
  try {
    const activities = await strava.getRecentActivities(14);
    const targetDate = req.query.date ? new Date(req.query.date) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
    const recommendation = training.generateRecommendation(activities, targetDate);
    res.json(recommendation);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const activities = await strava.getRecentActivities(14);
    const overview = training.getTrainingOverview(activities);
    res.json(overview);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/notify', async (req, res) => {
  try {
    const result = await scheduler.runDailyRecommendation();
    res.json(result || { error: 'No recommendation generated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Two-way SMS ---

router.get('/preferences', (req, res) => {
  res.json(conversations.getActivePrefs());
});

router.post('/preferences', (req, res) => {
  const prefs = conversations.loadPrefs();
  const updates = req.body;
  if (updates.longRunDays) prefs.longRunDays = updates.longRunDays;
  if (updates.maxLongRunMiles !== undefined) prefs.maxLongRunMiles = updates.maxLongRunMiles;
  if (updates.preferredTimeOfDay !== undefined) prefs.preferredTimeOfDay = updates.preferredTimeOfDay;
  conversations.savePrefs(prefs);
  res.json(prefs);
});

// Twilio inbound SMS webhook
router.post('/sms/inbound', async (req, res) => {
  const body = req.body.Body || '';
  const from = req.body.From || '';

  console.log(`[SMS] Inbound from ${from}: ${body}`);

  try {
    const { response } = await conversations.processInboundMessage(body);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(response)}</Message></Response>`);
  } catch (err) {
    console.error('[SMS] Error processing message:', err.message);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Got your message! I'll factor that into your training.</Message></Response>`);
  }
});

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// --- Health ---

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    stravaConnected: strava.isConnected(),
    smsConfigured: notifications.isConfigured(),
    daysUntilRace: training.getDaysUntilRace(),
  });
});

module.exports = router;
