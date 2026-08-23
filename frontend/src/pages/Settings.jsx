import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function Settings() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await client.get('/calendar/status');
      setStatus(res.data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const res = await client.get('/calendar/oauth/start');
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      {params.get('calendar') === 'connected' && (
        <div className="alert alert-info">Google Calendar connected successfully.</div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Google Calendar</h2>
        {status?.mocked ? (
          <p className="muted">
            This server doesn't have Google Calendar credentials configured, so calendar events
            for all users are created in mock mode automatically — nothing to connect here.
          </p>
        ) : status?.connected ? (
          <p>✅ Your Google Calendar is connected. Appointment events will sync automatically.</p>
        ) : (
          <>
            <p className="muted">Connect your Google Calendar so appointments automatically appear on it.</p>
            <button className="btn btn-primary" onClick={connect} disabled={busy}>
              {busy ? 'Redirecting...' : 'Connect Google Calendar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
