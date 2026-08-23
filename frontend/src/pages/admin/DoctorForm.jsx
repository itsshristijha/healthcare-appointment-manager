import { useState } from 'react';
import client from '../../api/client';

const DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

function defaultWorkingHours(existing) {
  const base = {};
  for (const [key] of DAYS) {
    const ranges = existing?.[key];
    base[key] = ranges && ranges.length ? { enabled: true, start: ranges[0].start, end: ranges[0].end } : { enabled: false, start: '09:00', end: '17:00' };
  }
  return base;
}

export default function DoctorForm({ doctor, onDone }) {
  const isEdit = Boolean(doctor);
  const [form, setForm] = useState({
    name: doctor?.user?.name || '',
    email: doctor?.user?.email || '',
    password: '',
    phone: doctor?.user?.phone || '',
    specialization: doctor?.specialization || '',
    bio: doctor?.bio || '',
    slotDurationMinutes: doctor?.slotDurationMinutes || 30,
  });
  const [hours, setHours] = useState(defaultWorkingHours(doctor?.workingHours));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateDay(day, field, value) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }));
  }

  function buildWorkingHours() {
    const wh = {};
    for (const [key] of DAYS) {
      wh[key] = hours[key].enabled ? [{ start: hours[key].start, end: hours[key].end }] : [];
    }
    return wh;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const workingHours = buildWorkingHours();
      if (isEdit) {
        await client.put(`/admin/doctors/${doctor.id}`, {
          name: form.name,
          phone: form.phone,
          specialization: form.specialization,
          bio: form.bio,
          slotDurationMinutes: Number(form.slotDurationMinutes),
          workingHours,
        });
      } else {
        await client.post('/admin/doctors', {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          specialization: form.specialization,
          bio: form.bio,
          slotDurationMinutes: Number(form.slotDurationMinutes),
          workingHours,
        });
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card doctor-form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <label>Full name
        <input required value={form.name} onChange={update('name')} />
      </label>
      {!isEdit && (
        <>
          <label>Email
            <input type="email" required value={form.email} onChange={update('email')} />
          </label>
          <label>Temporary password
            <input type="password" required minLength={6} value={form.password} onChange={update('password')} />
          </label>
        </>
      )}
      <label>Phone
        <input value={form.phone} onChange={update('phone')} />
      </label>
      <label>Specialization
        <input required value={form.specialization} onChange={update('specialization')} placeholder="e.g. Dermatologist" />
      </label>
      <label>Bio
        <textarea rows={2} value={form.bio} onChange={update('bio')} />
      </label>
      <label>Slot duration (minutes)
        <input type="number" min={5} max={120} value={form.slotDurationMinutes} onChange={update('slotDurationMinutes')} />
      </label>

      <h3>Working hours</h3>
      <div className="working-hours-grid">
        {DAYS.map(([key, label]) => (
          <div className="working-hours-row" key={key}>
            <label className="checkbox-label">
              <input type="checkbox" checked={hours[key].enabled} onChange={(e) => updateDay(key, 'enabled', e.target.checked)} />
              {label}
            </label>
            <input type="time" value={hours[key].start} disabled={!hours[key].enabled}
              onChange={(e) => updateDay(key, 'start', e.target.value)} />
            <span>to</span>
            <input type="time" value={hours[key].end} disabled={!hours[key].enabled}
              onChange={(e) => updateDay(key, 'end', e.target.value)} />
          </div>
        ))}
      </div>

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Create doctor'}
      </button>
    </form>
  );
}
