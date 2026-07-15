import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import StravaConnect from './StravaConnect.jsx';

const ALL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PreferencesView({ status, onReconnect }) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.preferences();
      setPrefs(data);
    } catch {
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleDay(day) {
    if (!prefs) return;
    const days = prefs.longRunDays.includes(day)
      ? prefs.longRunDays.filter(d => d !== day)
      : [...prefs.longRunDays, day];
    setSaving(true);
    const updated = await api.updatePrefs({ longRunDays: days });
    setPrefs(updated);
    setSaving(false);
  }

  async function setMaxMiles(val) {
    setSaving(true);
    const updated = await api.updatePrefs({ maxLongRunMiles: val || null });
    setPrefs(updated);
    setSaving(false);
  }

  async function setTimeOfDay(val) {
    setSaving(true);
    const updated = await api.updatePrefs({ preferredTimeOfDay: val || null });
    setPrefs(updated);
    setSaving(false);
  }

  async function handleTestNotification() {
    setTestResult('sending...');
    try {
      const result = await api.notify();
      setTestResult(result.notification?.success ? 'Sent!' : result.notification?.error || result.error || 'Check config');
    } catch (err) {
      setTestResult(err.message);
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading settings...</p></div>;

  return (
    <div className="settings-view">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3 className="section-title">Strava Connection</h3>
        {status?.connected ? (
          <div className="strava-status connected">
            <span className="status-dot green" />
            Connected{status.athlete ? ` as ${status.athlete.firstname} ${status.athlete.lastname}` : ''}
          </div>
        ) : (
          <StravaConnect onConnected={onReconnect} compact />
        )}
      </div>

      <div className="settings-section">
        <h3 className="section-title">Long Run Days</h3>
        <p className="settings-hint">Which days work best for your long runs?</p>
        <div className="day-picker">
          {ALL_DAYS.map(day => (
            <button
              key={day}
              className={`day-btn${prefs?.longRunDays?.includes(day) ? ' selected' : ''}`}
              onClick={() => toggleDay(day)}
              disabled={saving}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Max Long Run</h3>
        <p className="settings-hint">Cap your longest run distance (leave blank for auto)</p>
        <div className="input-row">
          <input
            type="number"
            className="settings-input"
            placeholder="Auto"
            value={prefs?.maxLongRunMiles || ''}
            onChange={e => setMaxMiles(e.target.value ? parseInt(e.target.value, 10) : null)}
            min="5" max="50"
          />
          <span className="input-unit">miles</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Preferred Time</h3>
        <div className="toggle-row">
          {['morning', 'evening'].map(t => (
            <button
              key={t}
              className={`toggle-btn${prefs?.preferredTimeOfDay === t ? ' selected' : ''}`}
              onClick={() => setTimeOfDay(prefs?.preferredTimeOfDay === t ? null : t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {prefs?.limitations?.length > 0 && (
        <div className="settings-section">
          <h3 className="section-title">Active Limitations</h3>
          {prefs.limitations.map((l, i) => (
            <div key={i} className="limitation-item">
              <span>{l.text}</span>
              <span className="limitation-date">{l.date}</span>
            </div>
          ))}
          <p className="settings-hint">Text "feeling good" to clear</p>
        </div>
      )}

      <div className="settings-section">
        <h3 className="section-title">Notifications</h3>
        <div className="strava-status">
          <span className={`status-dot ${status?.notificationsConfigured ? 'green' : 'red'}`} />
          SMS {status?.notificationsConfigured ? 'configured' : 'not configured'}
        </div>
        {status?.notificationsConfigured && (
          <button className="btn-secondary" onClick={handleTestNotification}>
            {testResult || 'Send Test Notification'}
          </button>
        )}
        {!status?.notificationsConfigured && (
          <p className="settings-hint">Set TWILIO_* and NOTIFICATION_PHONE_NUMBER env vars to enable SMS</p>
        )}
      </div>

      <div className="settings-section">
        <h3 className="section-title">SMS Commands</h3>
        <div className="sms-card">
          <div className="sms-examples">
            <code>"Long runs on Sat and Sun"</code>
            <code>"Knee is sore"</code>
            <code>"Max 20 miles"</code>
            <code>"Prefer mornings"</code>
            <code>"Feeling good"</code>
            <code>"STATUS"</code>
            <code>"HELP"</code>
            <code>"RESET"</code>
          </div>
        </div>
      </div>
    </div>
  );
}
