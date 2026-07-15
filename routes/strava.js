const express = require('express');
const router = express.Router();
const strava = require('../services/strava');
const training = require('../services/training');
const scheduler = require('../services/scheduler');
const notifications = require('../services/notifications');

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
  } catch (err) {
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

module.exports = router;
