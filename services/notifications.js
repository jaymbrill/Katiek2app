const https = require('https');

function getConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    toNumber: process.env.NOTIFICATION_PHONE_NUMBER,
  };
}

function isConfigured() {
  const { accountSid, authToken, fromNumber, toNumber } = getConfig();
  return !!(accountSid && authToken && fromNumber && toNumber);
}

async function sendSMS(message) {
  const { accountSid, authToken, fromNumber, toNumber } = getConfig();

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.warn('[Notifications] Twilio not configured. Message:', message);
    return { success: false, error: 'Twilio not configured' };
  }

  const postData = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Body: message,
  }).toString();

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Authorization: `Basic ${auth}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Notifications] SMS sent to ${toNumber}: ${parsed.sid}`);
            resolve({ success: true, sid: parsed.sid });
          } else {
            console.error(`[Notifications] SMS failed: ${parsed.message || data}`);
            resolve({ success: false, error: parsed.message || 'Unknown error' });
          }
        } catch {
          resolve({ success: false, error: 'Invalid response from Twilio' });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[Notifications] SMS error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(postData);
    req.end();
  });
}

async function sendWorkoutNotification(recommendation) {
  const maxLen = 1500;
  let msg = `🏃 Tomorrow's R2R2R Training:\n\n${recommendation.message}`;
  if (msg.length > maxLen) msg = msg.slice(0, maxLen - 3) + '...';
  return sendSMS(msg);
}

module.exports = { sendSMS, sendWorkoutNotification, isConfigured };
