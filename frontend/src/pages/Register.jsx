import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      navigate('/patient');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Patient registration</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Full name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>Phone
          <input value={form.phone} onChange={update('phone')} placeholder="+91-9XXXXXXXXX" />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={update('password')} required minLength={6} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Register'}</button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
