import { useState } from 'react';
import { api } from '../api/client.js';

export default function StravaConnect({ onConnected, compact }) {
  const [error, setError] = useState(null);

  async function handleConnect() {
    try {
      const { url } = await api.authUrl();
      window.location.href = url;
    } catch {
      setError('Unable to connect. Check server config.');
    }
  }

  if (compact) {
    return (
      <div>
        <button className="btn-strava compact" onClick={handleConnect}>Connect Strava</button>
        {error && <p className="strava-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-icon">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="#FC4C02">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
        </div>
        <h2>Connect Strava</h2>
        <p>Link your Strava account to get personalized R2R2R training recommendations based on your actual running data.</p>

        <div className="connect-features">
          <div>Dynamic daily workout plans adjusted to your fitness</div>
          <div>Fatigue-aware recommendations from Strava data</div>
          <div>Daily text by 8pm with tomorrow's workout</div>
          <div>Text back to set preferences and limitations</div>
          <div>Periodized training through race day Oct 7</div>
        </div>

        <button className="btn-strava" onClick={handleConnect}>Connect with Strava</button>
        {error && <p className="strava-error">{error}</p>}
      </div>
    </div>
  );
}
