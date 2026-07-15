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

const TYPE_COLORS = {
  rest: '#64748b', easy: '#22c55e', recovery: '#22c55e', long: '#3b82f6', backToBack: '#3b82f6',
  tempo: '#f59e0b', intervals: '#ef4444', hills: '#ef4444', trail: '#8b5cf6',
  cross: '#06b6d4', vert: '#f97316', heatAcclim: '#ef4444',
};

function TomorrowCard({ rec }) {
  if (!rec) return null;
  const color = TYPE_COLORS[rec.workoutType] || 'var(--primary)';
  return (
    <div className="tomorrow-card" style={{ borderLeftColor: color }}>
      <div className="tomorrow-label">Tomorrow's Workout</div>
      <div className="tomorrow-name" style={{ color }}>{rec.workout.name}</div>
      {rec.suggestedMiles > 0 && (
        <div className="tomorrow-detail">{rec.suggestedMiles} miles · {rec.workout.effort}</div>
      )}
      {rec.suggestedElevation > 0 && (
        <div className="tomorrow-detail">{rec.suggestedElevation}+ ft elevation gain</div>
      )}
      {rec.workoutType === 'rest' && (
        <div className="tomorrow-detail">Complete rest or gentle stretching</div>
      )}
      {rec.workoutType === 'cross' && (
        <div className="tomorrow-detail">Cycling, swimming, yoga, or strength</div>
      )}
      <div className="tomorrow-phase">{rec.phase} · {rec.daysUntilRace} days to race</div>
      <div className="tomorrow-description">{rec.workout.description}</div>
    </div>
  );
}

export default function TrainingDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.overview();
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Analyzing your training...</p></div>;
  if (error) return <div className="error-screen"><p>{error}</p><button className="btn-primary" onClick={load}>Retry</button></div>;
  if (!overview) return null;

  const { currentStats: stats, currentPhase: phase, daysUntilRace, race, upcoming, targetWeeklyMileage, preferences } = overview;
  const weekPct = targetWeeklyMileage > 0 ? Math.round((stats.weeklyMiles / targetWeeklyMileage) * 100) : 0;
  const countdownPct = Math.round(((84 - Math.min(daysUntilRace, 84)) / 84) * 100);
  const tomorrow = upcoming[0];

  return (
    <div className="dashboard-view">
      <div className="race-header">
        <div className="race-info">
          <h2>{race.name}</h2>
          <div className="race-date">Oct 7, 2026 · Grand Canyon</div>
          <div className="phase-badge">{phase.name}</div>
        </div>
        <div className="countdown-ring">
          <ProgressRing pct={countdownPct} size={72} />
          <div className="countdown-text">
            <span className="countdown-num">{daysUntilRace}</span>
            <span className="countdown-label">days</span>
          </div>
        </div>
      </div>

      <TomorrowCard rec={tomorrow} />

      <div className="stats-row">
        <StatCard label="This Week" value={`${stats.weeklyMiles} mi`} sub={`of ${Math.round(targetWeeklyMileage)}`} />
        <StatCard label="Elevation" value={`${stats.weeklyElevation} ft`} />
        <StatCard label="Longest" value={`${stats.longestRun} mi`} />
        <StatCard label="Fatigue" value={stats.fatigueScore} sub={stats.fatigueScore > 60 ? 'High' : stats.fatigueScore > 30 ? 'Moderate' : 'Low'} />
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(weekPct, 100)}%` }} />
        <span className="progress-label">{weekPct}% of weekly target</span>
      </div>

      {preferences?.limitations?.length > 0 && (
        <div className="limitations-banner">
          Active adjustments: {preferences.limitations.map(l => l.text).join('; ')}
          <div className="limitations-hint">Text "feeling good" to clear</div>
        </div>
      )}

      <div className="race-details">
        <h3 className="section-title">Race Profile</h3>
        <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Distance</span><span className="detail-value">{race.distanceMiles} mi</span></div>
          <div className="detail-item"><span className="detail-label">Vert Gain</span><span className="detail-value">{race.elevationGainFt.toLocaleString()} ft</span></div>
          <div className="detail-item"><span className="detail-label">Terrain</span><span className="detail-value">Trail</span></div>
          <div className="detail-item"><span className="detail-label">Focus</span><span className="detail-value">{phase.focus}</span></div>
        </div>
      </div>

      <div className="sms-info">
        <h3 className="section-title">Two-Way SMS</h3>
        <div className="sms-card">
          <p>Text back to adjust your plan:</p>
          <div className="sms-examples">
            <code>"Long runs on Saturdays"</code>
            <code>"Knee is sore"</code>
            <code>"Max 20 miles"</code>
            <code>"Feeling good"</code>
          </div>
        </div>
      </div>
    </div>
  );
}
