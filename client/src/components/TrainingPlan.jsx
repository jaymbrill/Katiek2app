import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const TYPE_COLORS = {
  rest: '#64748b', easy: '#22c55e', recovery: '#22c55e', long: '#3b82f6', backToBack: '#3b82f6',
  tempo: '#f59e0b', intervals: '#ef4444', hills: '#ef4444', trail: '#8b5cf6',
  cross: '#06b6d4', vert: '#f97316', heatAcclim: '#ef4444',
};

function WorkoutCard({ rec, expanded, onToggle }) {
  const color = TYPE_COLORS[rec.workoutType] || 'var(--primary)';
  const dayName = new Date(rec.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={`workout-card${expanded ? ' workout-expanded' : ''}`} style={{ borderLeftColor: color }} onClick={onToggle}>
      <div className="workout-card-header">
        <span className="workout-day">{dayName}</span>
        <span className="workout-type-badge" style={{ background: color + '22', color }}>{rec.workout.name}</span>
      </div>
      {rec.suggestedMiles > 0 && (
        <div className="workout-detail">{rec.suggestedMiles} mi · {rec.workout.effort}</div>
      )}
      {rec.suggestedElevation > 0 && (
        <div className="workout-detail">{rec.suggestedElevation}+ ft vert</div>
      )}
      {rec.workoutType === 'rest' && <div className="workout-detail">Full rest or gentle stretching</div>}
      {rec.workoutType === 'cross' && <div className="workout-detail">Cycling, swimming, yoga, or strength</div>}
      {expanded && (
        <div className="workout-expanded-info">
          <div className="workout-desc">{rec.workout.description}</div>
          <div className="workout-hr">HR Zone: {rec.workout.hrZone}</div>
          <div className="workout-phase">{rec.phase} · {rec.daysUntilRace} days out</div>
        </div>
      )}
    </div>
  );
}

export default function TrainingPlan() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);

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

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading plan...</p></div>;
  if (error) return <div className="error-screen"><p>{error}</p><button className="btn-primary" onClick={load}>Retry</button></div>;
  if (!overview) return null;

  const { upcoming, currentPhase: phase, daysUntilRace, weeksUntilRace, preferences } = overview;

  return (
    <div className="plan-view">
      <div className="plan-header">
        <h2>7-Day Plan</h2>
        <div className="plan-meta">{phase.name} · {Math.round(weeksUntilRace)} weeks out</div>
      </div>

      {preferences?.longRunDays?.length > 0 && (
        <div className="pref-banner">Long runs: {preferences.longRunDays.join(', ')}</div>
      )}

      <div className="workout-list">
        {upcoming.map((rec, i) => (
          <WorkoutCard
            key={rec.date}
            rec={rec}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}
      </div>

      <div className="plan-legend">
        <h3 className="section-title">Workout Types</h3>
        <div className="legend-grid">
          {Object.entries(TYPE_COLORS).map(([key, color]) => (
            <div key={key} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
