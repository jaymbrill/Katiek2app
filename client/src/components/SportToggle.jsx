export default function SportToggle({ sport, onChange }) {
  return (
    <div className="sport-toggle" role="group" aria-label="Select sport">
      <button
        className={sport === 'football' ? 'active' : ''}
        onClick={() => onChange('football')}
        aria-pressed={sport === 'football'}
      >
        Football
      </button>
      <button
        className={sport === 'basketball' ? 'active' : ''}
        onClick={() => onChange('basketball')}
        aria-pressed={sport === 'basketball'}
      >
        Hoops
      </button>
    </div>
  );
}
