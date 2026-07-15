import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

function ProgressRing({ pct, size = 80, strokeWidth = 6 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--primary)" strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="training-stat">
      <div className="training-stat-value">{value}</div>
      <div className="training-stat-label">{label}</div>
      {sub && <div className="training-stat-sub">{sub}</div>}
    </div>
  );
}

function WorkoutCard({ rec, isToday }) {
  const typeColors = {
    rest: '#64748b', easy: '#22c55e', recovery: '#22c55e', long: '#3b82f6', backToBack: '#3b82f6',
    tempo: '#f59e0b', intervals: '#ef4444', hills: '#ef4444', trail: '#8b5cf6',
    cross: '#06b6d4', vert: '#f97316', heatAcclim: '#ef4444',
  };
  const color = typeColors[rec.workoutType] || 'var(--primary)';
  const dayName = new Date(rec.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={`workout-card${isToday ? ' workout-today' : ''}`} style={{ borderLeftColor: color }}>
      <div className="workout-card-header">
        <span className="workout-day">{isToday ? 'Tomorrow' : dayName}</span>
        <span className="workout-type-badge" style={{ background: color + '22', color }}>{rec.workout.name}</span>
      </div>
      {rec.suggestedMiles > 0 && (
        <div className="workout-detail">{rec.suggestedMiles} mi · {rec.workout.effort}</div>
      )}
      {rec.suggestedElevation > 0 && (
        <div className="workout-detail">{rec.suggestedElevation}+ ft vert</div>
      )}
      {rec.workoutType === 'rest' && (
        <div className="workout-detail">Full rest or gentle stretching</div>
      )}
      {rec.workoutType === 'cross' && (
        <div className="workout-detail">Cycling, swimming, yoga, or strength</div>
      )}
    </div>
  );
}

export default function TrainingView() {
  const [status, setStatus] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.strava.status();
      setStatus(s);
      if (s.connected) {
        const o = await api.strava.overview();
        setOverview(o);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava') === 'connected') {
      window.history.replaceState({}, '', '/');
      load();
    }
  }, [load]);

  if (loading) {
    return (
      <div className="training-loading">
        <div className="spinner" />
        <p>Loading training data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="training-error">
        <p>Error: {error}</p>
        <button className="btn-primary" onClick={load}>Retry</button>
      </div>
    );
  }

  if (!status?.connected) {
    return <StravaConnect />;
  }

  const { currentStats: stats, currentPhase: phase, daysUntilRace, weeksUntilRace, race, upcoming, targetWeeklyMileage } = overview;
  const weekPct = stats.weeklyMiles > 0 ? Math.round((stats.weeklyMiles / targetWeeklyMileage) * 100) : 0;
  const countdownPct = Math.round(((84 - Math.min(daysUntilRace, 84)) / 84) * 100);

  return (
    <div className="training-view">
      <div className="training-race-header">
        <div className="training-race-info">
          <h2>R2R2R Training</h2>
          <div className="training-race-date">Oct 7, 2026 · Grand Canyon</div>
          <div className="training-phase-badge">{phase.name}</div>
        </div>
        <div className="training-countdown">
          <ProgressRing pct={countdownPct} size={72} />
          <div className="training-countdown-text">
            <span className="training-days-num">{daysUntilRace}</span>
            <span className="training-days-label">days</span>
          </div>
        </div>
      </div>

      <div className="training-stats-row">
        <StatCard label="This Week" value={`${stats.weeklyMiles} mi`} sub={`of ${Math.round(targetWeeklyMileage)} target`} />
        <StatCard label="Elevation" value={`${stats.weeklyElevation} ft`} />
        <StatCard label="Longest" value={`${stats.longestRun} mi`} />
        <StatCard label="Fatigue" value={stats.fatigueScore} sub={stats.fatigueScore > 60 ? 'High' : stats.fatigueScore > 30 ? 'Moderate' : 'Low'} />
      </div>

      <div className="training-progress-bar">
        <div className="training-progress-fill" style={{ width: `${Math.min(weekPct, 100)}%` }} />
        <span className="training-progress-label">{weekPct}% of weekly target</span>
      </div>

      <h3 className="training-section-title">Upcoming Workouts</h3>
      <div className="workout-list">
        {upcoming.map((rec, i) => (
          <WorkoutCard key={rec.date} rec={rec} isToday={i === 0} />
        ))}
      </div>

      <div className="training-race-details">
        <h3 className="training-section-title">Race Profile</h3>
        <div className="race-detail-grid">
          <div className="race-detail-item">
            <span className="race-detail-label">Distance</span>
            <span className="race-detail-value">{race.distanceMiles} mi</span>
          </div>
          <div className="race-detail-item">
            <span className="race-detail-label">Elevation</span>
            <span className="race-detail-value">{race.elevationGainFt.toLocaleString()} ft</span>
          </div>
          <div className="race-detail-item">
            <span className="race-detail-label">Terrain</span>
            <span className="race-detail-value">Trail</span>
          </div>
          <div className="race-detail-item">
            <span className="race-detail-label">Phase Focus</span>
            <span className="race-detail-value">{phase.focus}</span>
          </div>
        </div>
      </div>

      {status.athlete && (
        <div className="training-athlete">
          Connected as {status.athlete.firstname} {status.athlete.lastname}
        </div>
      )}
    </div>
  );
}

function StravaConnect() {
  const [authUrl, setAuthUrl] = useState(null);

  async function handleConnect() {
    try {
      const { url } = await api.strava.authUrl();
      window.location.href = url;
    } catch {
      setAuthUrl('error');
    }
  }

  return (
    <div className="strava-connect">
      <div className="strava-connect-card">
        <div className="strava-logo">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#FC4C02">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
        </div>
        <h2>Connect Strava</h2>
        <p>Link your Strava account to get personalized R2R2R training recommendations based on your actual running data.</p>
        <div className="strava-features">
          <div>Dynamic daily workout plans</div>
          <div>Fatigue-adjusted recommendations</div>
          <div>SMS notifications by 8pm daily</div>
          <div>Periodized R2R2R training</div>
        </div>
        <button className="btn-strava" onClick={handleConnect}>
          Connect with Strava
        </button>
        {authUrl === 'error' && (
          <p className="strava-error">Unable to connect. Check server configuration (STRAVA_CLIENT_ID required).</p>
        )}
      </div>
    </div>
  );
}
