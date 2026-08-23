import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = { patient: '/patient', doctor: '/doctor', admin: '/admin' };

export default function Login({ expectedRole }) {
  const { login, completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setBusy(true);
    completeGoogleLogin(token)
      .then((user) => navigate(ROLE_HOME[user.role] || '/'))
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, [completeGoogleLogin, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password, expectedRole);
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
        <h1>{expectedRole ? `${expectedRole === 'doctor' ? 'Doctor' : 'Patient'} login` : 'Log in'}</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        <a className="btn btn-secondary" href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/google/start${expectedRole ? `?role=${expectedRole}` : ''}`}>
          Continue with Google
        </a>
        {expectedRole === 'patient' && <p className="auth-switch">New patient? <Link to="/register">Register here</Link></p>}
        {!expectedRole && <p className="auth-switch"><Link to="/patient/login">Patient login</Link> or <Link to="/doctor/login">Doctor login</Link></p>}
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
