import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function NotificationLogs() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await client.get('/admin/notifications', { params: status ? { status } : {} });
      setLogs(res.data.logs);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notification log</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed (retrying)</option>
          <option value="permanently_failed">Permanently failed</option>
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Time</th><th>Type</th><th>Recipient</th><th>Subject</th><th>Status</th><th>Retries</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.type}</td>
              <td>{l.recipientEmail}</td>
              <td>{l.subject}</td>
              <td><span className={`badge badge-${l.status === 'sent' ? 'confirmed' : l.status === 'pending' ? 'pending' : 'cancelled'}`}>{l.status}</span></td>
              <td>{l.retryCount}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={6} className="muted">No notifications logged yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
