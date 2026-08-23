import { useState } from 'react';
import client from '../../api/client';

const emptyMed = { medication: '', dosage: '', frequencyPerDay: 2, durationDays: 5, instructions: '' };

export default function PostVisitForm({ appointmentId, onDone }) {
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState([{ ...emptyMed }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateMed(index, field, value) {
    setPrescription((list) => list.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  function addMed() {
    setPrescription((list) => [...list, { ...emptyMed }]);
  }

  function removeMed(index) {
    setPrescription((list) => list.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleaned = prescription.filter((m) => m.medication.trim());
      await client.post(`/appointments/${appointmentId}/post-visit`, { notes, prescription: cleaned });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-visit-form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <label>Clinical notes
        <textarea rows={4} required value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Findings, diagnosis, treatment plan..." />
      </label>

      <h3>Prescription</h3>
      {prescription.map((m, i) => (
        <div className="prescription-row" key={i}>
          <input placeholder="Medication" value={m.medication} onChange={(e) => updateMed(i, 'medication', e.target.value)} />
          <input placeholder="Dosage (e.g. 500mg)" value={m.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)} />
          <input type="number" min={1} max={4} placeholder="x/day" value={m.frequencyPerDay}
            onChange={(e) => updateMed(i, 'frequencyPerDay', Number(e.target.value))} />
          <input type="number" min={1} placeholder="Days" value={m.durationDays}
            onChange={(e) => updateMed(i, 'durationDays', Number(e.target.value))} />
          <input placeholder="Instructions" value={m.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)} />
          <button type="button" className="btn btn-ghost" onClick={() => removeMed(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={addMed}>+ Add medication</button>

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Submitting...' : 'Generate summary & complete visit'}
      </button>
    </form>
  );
}
