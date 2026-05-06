import { useState, useEffect } from 'react';
import { api } from '../api/client.js';

export default function TeamSelector({ onDone }) {
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    api.teams().then(setTeams).catch(() => {});
  }, []);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="team-selector-overlay" role="dialog" aria-modal="true" aria-label="Choose your teams">
      <div className="team-selector-header">
        <div className="ts-logo">🏈</div>
        <h1 className="ts-title">Pick Your Teams</h1>
        <p className="ts-subtitle">
          Choose your favorite Big Ten teams to personalize your dashboard.
        </p>
      </div>

      <div className="ts-team-grid" role="group" aria-label="Big Ten teams">
        {teams.map(team => (
          <button
            key={team.id}
            className={`ts-team-btn${selected.has(team.id) ? ' selected' : ''}`}
            onClick={() => toggle(team.id)}
            aria-pressed={selected.has(team.id)}
          >
            <div className="ts-team-logo-ph" style={{ background: team.color ? `#${team.color}22` : undefined }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: team.color ? `#${team.color}` : undefined }}>
                {team.abbr}
              </span>
            </div>
            <span className="ts-team-name">{team.name}</span>
          </button>
        ))}
      </div>

      <div className="ts-footer">
        <button
          className="ts-cta"
          onClick={() => onDone([...selected])}
          disabled={selected.size === 0}
        >
          {selected.size > 0
            ? `Follow ${selected.size} team${selected.size > 1 ? 's' : ''} →`
            : 'Select at least one team'}
        </button>
        <button className="ts-skip" onClick={() => onDone([])}>
          Skip — show all Big Ten
        </button>
      </div>
    </div>
  );
}
