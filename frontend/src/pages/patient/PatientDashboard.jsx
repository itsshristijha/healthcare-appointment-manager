import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { doctorDisplayName } from '../../utils/format';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/appointments/mine');
      setAppointments(res.data.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    setCancellingId(id);
    try {
      await client.post(`/appointments/${id}/cancel`);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = appointments.filter((a) => ['pending', 'confirmed'].includes(a.status));
  const past = appointments.filter((a) => ['completed', 'cancelled'].includes(a.status));

  return (
    <div className="page">
      <div className="page-header">
        <h1>My appointments</h1>
        <Link className="btn btn-primary" to="/patient/book">+ Book new appointment</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Upcoming</h2>
          {upcoming.length === 0 && <p className="muted">No upcoming appointments.</p>}
          <div className="card-grid">
            {upcoming.map((a) => (
              <div className="card appointment-card" key={a.id}>
                <div className="appointment-card-top">
                  <strong>{doctorDisplayName(a.doctor.user.name)}</strong>
                  <StatusBadge status={a.status} />
                </div>
                <p className="muted">{a.doctor.specialization}</p>
                <p>{new Date(a.slotStart).toLocaleString()}</p>
                {a.preVisitSummary && (
                  <p className="urgency-line">
                    Urgency: <span className={`urgency urgency-${a.preVisitSummary.urgencyLevel?.toLowerCase()}`}>
                      {a.preVisitSummary.urgencyLevel}
                    </span>
                  </p>
                )}
                <button className="btn btn-ghost" onClick={() => cancel(a.id)} disabled={cancellingId === a.id}>
                  {cancellingId === a.id ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            ))}
          </div>

          <h2>Past</h2>
          {past.length === 0 && <p className="muted">No past appointments yet.</p>}
          <div className="card-grid">
            {past.map((a) => (
              <div className="card appointment-card" key={a.id}>
                <div className="appointment-card-top">
                  <strong>{doctorDisplayName(a.doctor.user.name)}</strong>
                  <StatusBadge status={a.status} />
                </div>
                <p className="muted">{a.doctor.specialization}</p>
                <p>{new Date(a.slotStart).toLocaleString()}</p>
                {a.status === 'cancelled' && a.cancelReason && <p className="muted">Reason: {a.cancelReason}</p>}
                {a.postVisitSummary && (
                  <details>
                    <summary>View visit summary</summary>
                    <p>{a.postVisitSummary.summaryText}</p>
                    <p><strong>Medication schedule:</strong> {a.postVisitSummary.medicationSchedule}</p>
                    <p><strong>Follow-up:</strong> {a.postVisitSummary.followUpSteps}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
