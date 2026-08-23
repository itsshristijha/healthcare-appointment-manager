import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { doctorDisplayName } from '../../utils/format';

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookAppointment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [specializations, setSpecializations] = useState([]);
  const [specFilter, setSpecFilter] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState(todayPlus(1));
  const [slots, setSlots] = useState([]);
  const [onLeave, setOnLeave] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [hold, setHold] = useState(null);
  const [symptomText, setSymptomText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [holdCountdown, setHoldCountdown] = useState(null);

  useEffect(() => {
    client.get('/doctors/specializations').then((res) => setSpecializations(res.data.specializations)).catch(() => {});
  }, []);

  useEffect(() => {
    client
      .get('/doctors', { params: specFilter ? { specialization: specFilter } : {} })
      .then((res) => setDoctors(res.data.doctors))
      .catch((err) => setError(err.message));
  }, [specFilter]);

  useEffect(() => {
    if (!hold) return undefined;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - Date.now()) / 1000));
      setHoldCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setError('Your slot hold expired. Please select a slot again.');
        setStep(2);
        setHold(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hold]);

  async function loadSlots(doctor, chosenDate) {
    setError('');
    setSelectedSlot(null);
    try {
      const res = await client.get(`/doctors/${doctor.id}/slots`, { params: { date: chosenDate } });
      setSlots(res.data.slots);
      setOnLeave(res.data.onLeave);
    } catch (err) {
      setError(err.message);
    }
  }

  function chooseDoctor(doctor) {
    setSelectedDoctor(doctor);
    setStep(2);
    loadSlots(doctor, date);
  }

  function changeDate(newDate) {
    setDate(newDate);
    if (selectedDoctor) loadSlots(selectedDoctor, newDate);
  }

  async function chooseSlot(slot) {
    setError('');
    setBusy(true);
    try {
      const res = await client.post('/appointments/hold', {
        doctorId: selectedDoctor.id,
        slotStart: slot.start,
        slotEnd: slot.end,
      });
      setHold(res.data.hold);
      setSelectedSlot(slot);
      setStep(3);
    } catch (err) {
      setError(err.message);
      loadSlots(selectedDoctor, date);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await client.post('/appointments/confirm', { holdId: hold.id, symptomText });
      setConfirmedAppointment(res.data.appointment);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Book an appointment</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="steps">
        <span className={step === 1 ? 'step active' : 'step'}>1. Doctor</span>
        <span className={step === 2 ? 'step active' : 'step'}>2. Slot</span>
        <span className={step === 3 ? 'step active' : 'step'}>3. Symptoms</span>
        <span className={step === 4 ? 'step active' : 'step'}>4. Done</span>
      </div>

      {step === 1 && (
        <div className="card">
          <label>Filter by specialization
            <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value)}>
              <option value="">All specializations</option>
              {specializations.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="card-grid">
            {doctors.map((d) => (
              <div className="card doctor-card" key={d.id}>
                <strong>{doctorDisplayName(d.user.name)}</strong>
                <p className="muted">{d.specialization}</p>
                <p>{d.bio}</p>
                <button className="btn btn-primary" onClick={() => chooseDoctor(d)}>Select</button>
              </div>
            ))}
            {doctors.length === 0 && <p className="muted">No doctors found.</p>}
          </div>
        </div>
      )}

      {step === 2 && selectedDoctor && (
        <div className="card">
          <button className="btn btn-ghost" onClick={() => setStep(1)}>&larr; Change doctor</button>
          <h2>{doctorDisplayName(selectedDoctor.user.name)} — {selectedDoctor.specialization}</h2>
          <label>Date
            <input type="date" value={date} min={todayPlus(0)} onChange={(e) => changeDate(e.target.value)} />
          </label>
          {onLeave ? (
            <p className="alert alert-info">Doctor is on leave this date. Please pick another date.</p>
          ) : (
            <div className="slot-grid">
              {slots.map((s) => (
                <button
                  key={s.start}
                  className="slot-btn"
                  disabled={busy}
                  onClick={() => chooseSlot(s)}
                >
                  {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
              {slots.length === 0 && <p className="muted">No available slots on this date.</p>}
            </div>
          )}
        </div>
      )}

      {step === 3 && hold && (
        <form className="card" onSubmit={confirmBooking}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>&larr; Change slot</button>
          <h2>Symptom form</h2>
          <p className="muted">
            Slot held for you until {new Date(hold.expiresAt).toLocaleTimeString()}
            {holdCountdown !== null && ` (${holdCountdown}s remaining)`}. Please complete the form to confirm.
          </p>
          <label>Describe your symptoms
            <textarea
              rows={5}
              required
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder="e.g. I've had a mild fever and sore throat for two days..."
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Confirming...' : 'Confirm appointment'}
          </button>
        </form>
      )}

      {step === 4 && confirmedAppointment && (
        <div className="card">
          <h2>✅ Appointment confirmed!</h2>
          <p>{doctorDisplayName(selectedDoctor.user.name)} — {new Date(confirmedAppointment.slotStart).toLocaleString()}</p>
          {confirmedAppointment.preVisitSummary && (
            <div className="pre-visit-box">
              <p>Urgency assessed as: <strong>{confirmedAppointment.preVisitSummary.urgencyLevel}</strong></p>
              <p className="muted">Your doctor will see this AI-generated summary before your visit.</p>
            </div>
          )}
          <p className="muted">A confirmation email and calendar invite have been sent to you and your doctor.</p>
          <button className="btn btn-primary" onClick={() => navigate('/patient')}>Go to my appointments</button>
        </div>
      )}
    </div>
  );
}
