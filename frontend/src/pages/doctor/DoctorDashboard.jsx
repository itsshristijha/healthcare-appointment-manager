import { useEffect, useState } from 'react';
import client from '../../api/client';
import PostVisitForm from './PostVisitForm';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DoctorDashboard() {
  const [date, setDate] = useState(todayStr());
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/appointments/doctor', { params: { date } });
      setAppointments(res.data.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function cancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await client.post(`/appointments/${id}/cancel`);
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Appointments</h1>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : appointments.length === 0 ? (
        <p className="muted">No appointments on this date.</p>
      ) : (
        <div className="appointment-list">
          {appointments.map((a) => (
            <div className="card" key={a.id}>
              <div className="appointment-card-top">
                <strong>{a.patient.name}</strong>
                <span className={`badge badge-${a.status}`}>{a.status}</span>
              </div>
              <p className="muted">{new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {a.patient.email} {a.patient.phone ? `· ${a.patient.phone}` : ''}</p>

              {a.preVisitSummary && (
                <div className="pre-visit-box">
                  <p>Urgency: <span className={`urgency urgency-${a.preVisitSummary.urgencyLevel?.toLowerCase()}`}>{a.preVisitSummary.urgencyLevel}</span></p>
                  <p><strong>Chief complaint:</strong> {a.preVisitSummary.chiefComplaint}</p>
                  <p><strong>Symptoms (patient-reported):</strong> {a.symptomText}</p>
                  <p><strong>Suggested questions:</strong></p>
                  <ul>
                    {a.preVisitSummary.suggestedQuestions?.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                  {a.preVisitSummary.degraded && <p className="muted">(AI summary generated in fallback mode)</p>}
                </div>
              )}

              <div className="row-actions">
                {a.status === 'confirmed' && (
                  <button className="btn btn-primary" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                    {openId === a.id ? 'Close form' : 'Submit post-visit notes'}
                  </button>
                )}
                {['pending', 'confirmed'].includes(a.status) && (
                  <button className="btn btn-ghost" onClick={() => cancel(a.id)}>Cancel</button>
                )}
              </div>

              {openId === a.id && (
                <PostVisitForm
                  appointmentId={a.id}
                  onDone={() => {
                    setOpenId(null);
                    load();
                  }}
                />
              )}

              {a.status === 'completed' && a.postVisitSummary && (
                <details>
                  <summary>View submitted summary</summary>
                  <p>{a.postVisitSummary.summaryText}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
