import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function DoctorLeave() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.doctorProfileId) return;
    client
      .get(`/doctors/${user.doctorProfileId}/leave`)
      .then((res) => setLeaves(res.data.leaves))
      .catch((err) => setError(err.message));
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post('/doctors/me/leave', { date, reason });
      setDate('');
      setReason('');
      const res = await client.get(`/doctors/${user.doctorProfileId}/leave`);
      setLeaves(res.data.leaves);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeLeave(leaveDate) {
    try {
      await client.delete(`/doctors/me/leave/${leaveDate}`);
      setLeaves(leaves.filter((leave) => leave.date !== leaveDate));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>My upcoming leave</h1>
      <p className="muted">Choose a date to take leave. Any patients already booked that day will be automatically cancelled and notified by email.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="inline-form" onSubmit={submit}>
        <label>Date <input type="date" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Reason <input placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Take leave'}</button>
      </form>
      {leaves.length === 0 ? (
        <p className="muted">No leave days scheduled.</p>
      ) : (
        <ul className="leave-list">
          {leaves.map((l) => (
            <li key={l.id}>
              {l.date} {l.reason ? `- ${l.reason}` : ''}
              <button className="btn btn-ghost" onClick={() => removeLeave(l.date)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
