import { useEffect, useState } from 'react';
import client from '../../api/client';
import { doctorDisplayName } from '../../utils/format';

export default function LeaveManager({ doctorId, doctorName }) {
  const [leaves, setLeaves] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  async function load() {
    const res = await client.get(`/admin/doctors/${doctorId}/leave`);
    setLeaves(res.data.leaves);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    setLastResult(null);
    try {
      const res = await client.post(`/admin/doctors/${doctorId}/leave`, { date, reason });
      setLastResult(res.data);
      setDate('');
      setReason('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeLeave(d) {
    await client.delete(`/admin/doctors/${doctorId}/leave/${d}`);
    load();
  }

  return (
    <div className="leave-manager">
      <h4>Leave days for {doctorDisplayName(doctorName)}</h4>
      {error && <div className="alert alert-error">{error}</div>}
      {lastResult && (
        <div className="alert alert-info">
          {lastResult.affectedAppointments} existing appointment(s) cancelled and patient(s) notified.
        </div>
      )}
      <form className="inline-form" onSubmit={submit}>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Add leave'}</button>
      </form>
      <ul className="leave-list">
        {leaves.map((l) => (
          <li key={l.id}>
            {l.date} {l.reason ? `— ${l.reason}` : ''}
            <button className="btn btn-ghost" onClick={() => removeLeave(l.date)}>Remove</button>
          </li>
        ))}
        {leaves.length === 0 && <li className="muted">No leave days set.</li>}
      </ul>
    </div>
  );
}
