import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function MedicationReminders() {
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/appointments/medication/mine')
      .then((res) => setReminders(res.data.reminders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <h1>Medication reminders</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : reminders.length === 0 ? (
        <p className="muted">No active medication schedules. These appear automatically after a completed visit.</p>
      ) : (
        <div className="card-grid">
          {reminders.map((r) => {
            const active = r.active && r.startDate <= today && r.endDate >= today;
            return (
              <div className="card" key={r.id}>
                <div className="appointment-card-top">
                  <strong>{r.medicationName}</strong>
                  <span className={`badge ${active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                    {active ? 'Active' : 'Ended'}
                  </span>
                </div>
                {r.dosage && <p className="muted">{r.dosage}</p>}
                <p>{r.frequencyPerDay}x/day at {r.timesOfDay.join(', ')}</p>
                <p className="muted">{r.startDate} to {r.endDate}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
