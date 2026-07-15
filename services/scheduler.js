const strava = require('./strava');
const training = require('./training');
const notifications = require('./notifications');

let schedulerInterval = null;
let lastNotificationDate = null;

async function runDailyRecommendation() {
  const today = new Date().toISOString().split('T')[0];

  if (lastNotificationDate === today) {
    console.log('[Scheduler] Already sent notification today, skipping');
    return null;
  }

  if (!strava.isConnected()) {
    console.warn('[Scheduler] Strava not connected, skipping daily recommendation');
    return null;
  }

  try {
    const activities = await strava.getRecentActivities(14);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const recommendation = training.generateRecommendation(activities, tomorrow);

    console.log(`[Scheduler] Generated recommendation for ${recommendation.date}: ${recommendation.workout.name}`);

    if (notifications.isConfigured()) {
      const result = await notifications.sendWorkoutNotification(recommendation);
      if (result.success) {
        lastNotificationDate = today;
        console.log('[Scheduler] Notification sent successfully');
      }
      return { recommendation, notification: result };
    }

    lastNotificationDate = today;
    return { recommendation, notification: { success: false, error: 'Notifications not configured' } };
  } catch (err) {
    console.error('[Scheduler] Error generating recommendation:', err.message);
    return { error: err.message };
  }
}

function getNotificationHour() {
  return parseInt(process.env.NOTIFICATION_HOUR || '20', 10); // Default 8pm
}

function getNotificationTimezone() {
  return process.env.NOTIFICATION_TIMEZONE || 'America/Denver';
}

function checkAndRun() {
  const targetHour = getNotificationHour();
  const now = new Date();

  // Convert to target timezone
  const tzTime = new Date(now.toLocaleString('en-US', { timeZone: getNotificationTimezone() }));
  const currentHour = tzTime.getHours();
  const currentMinute = tzTime.getMinutes();

  // Run within 15 min window of target hour
  if (currentHour === targetHour && currentMinute < 15) {
    runDailyRecommendation();
  }
}

function start() {
  if (schedulerInterval) return;

  console.log(`[Scheduler] Starting daily workout notifications at ${getNotificationHour()}:00 ${getNotificationTimezone()}`);

  // Check every 10 minutes
  schedulerInterval = setInterval(checkAndRun, 10 * 60 * 1000);

  // Also check immediately on startup
  checkAndRun();
}

function stop() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

module.exports = { start, stop, runDailyRecommendation };
