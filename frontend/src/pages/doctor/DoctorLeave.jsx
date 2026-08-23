import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Leave days are managed by the clinic admin (per the product brief). This
// page is a read-only view so a doctor can see their own upcoming leave.
export default function DoctorLeave() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.doctorProfileId) return;
    client
      .get(`/doctors/${user.doctorProfileId}/leave`)
      .then((res) => setLeaves(res.data.leaves))
      .catch((err) => setError(err.message));
  }, [user]);

  return (
    <div className="page">
      <h1>My upcoming leave</h1>
      <p className="muted">
        Leave days are set by the clinic admin. When a day is marked as leave, any patients
        already booked that day are automatically cancelled and notified by email.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {leaves.length === 0 ? (
        <p className="muted">No leave days scheduled.</p>
      ) : (
        <ul className="leave-list">
          {leaves.map((l) => (
            <li key={l.id}>{l.date} {l.reason ? `— ${l.reason}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
