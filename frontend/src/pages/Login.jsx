import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = { patient: '/patient', doctor: '/doctor', admin: '/admin' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Log in</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        <p className="auth-switch">New patient? <Link to="/register">Register here</Link></p>
        <div className="demo-hint">
          <strong>Demo accounts</strong> (seeded):<br />
          admin@clinic.example.com / Admin@123<br />
          asha.mehta@clinic.example.com / Doctor@123<br />
          patient@example.com / Patient@123
        </div>
      </form>
    </div>
  );
}
