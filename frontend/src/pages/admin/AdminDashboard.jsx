import { useEffect, useState } from 'react';
import client from '../../api/client';
import DoctorForm from './DoctorForm';
import LeaveManager from './LeaveManager';
import { doctorDisplayName } from '../../utils/format';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [leaveDoctor, setLeaveDoctor] = useState(null);

  async function load() {
    try {
      const res = await client.get('/admin/doctors');
      setDoctors(res.data.doctors);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function removeDoctor(id) {
    if (!confirm('Remove this doctor? This also removes their user account.')) return;
    try {
      await client.delete(`/admin/doctors/${id}`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Manage doctors</h1>
        <button className="btn btn-primary" onClick={() => setShowNewForm((v) => !v)}>
          {showNewForm ? 'Close' : '+ Add doctor'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {showNewForm && (
        <DoctorForm
          onDone={() => {
            setShowNewForm(false);
            load();
          }}
        />
      )}

      <div className="card-grid">
        {doctors.map((d) => (
          <div className="card" key={d.id}>
            <strong>{doctorDisplayName(d.user.name)}</strong>
            <p className="muted">{d.specialization} · {d.slotDurationMinutes} min slots</p>
            <p>{d.user.email}</p>
            <div className="row-actions">
              <button className="btn btn-secondary" onClick={() => setEditingDoctor(editingDoctor === d.id ? null : d.id)}>
                {editingDoctor === d.id ? 'Close edit' : 'Edit'}
              </button>
              <button className="btn btn-secondary" onClick={() => setLeaveDoctor(leaveDoctor === d.id ? null : d.id)}>
                {leaveDoctor === d.id ? 'Close leave' : 'Manage leave'}
              </button>
              <button className="btn btn-ghost" onClick={() => removeDoctor(d.id)}>Remove</button>
            </div>
            {editingDoctor === d.id && (
              <DoctorForm
                doctor={d}
                onDone={() => {
                  setEditingDoctor(null);
                  load();
                }}
              />
            )}
            {leaveDoctor === d.id && <LeaveManager doctorId={d.id} doctorName={d.user.name} />}
          </div>
        ))}
      </div>
    </div>
  );
}
