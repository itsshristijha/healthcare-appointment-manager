import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Link to="/">🩺 Healthcare Appointment Manager</Link>
      </div>
      <nav className="navbar-links">
        {user?.role === 'patient' && (
          <>
            <Link to="/patient">Dashboard</Link>
            <Link to="/patient/book">Book Appointment</Link>
            <Link to="/patient/medications">Medications</Link>
            <Link to="/settings">Settings</Link>
          </>
        )}
        {user?.role === 'doctor' && (
          <>
            <Link to="/doctor">Today</Link>
            <Link to="/doctor/leave">Leave</Link>
            <Link to="/settings">Settings</Link>
          </>
        )}
        {user?.role === 'admin' && (
          <>
            <Link to="/admin">Doctors</Link>
            <Link to="/admin/notifications">Notifications</Link>
          </>
        )}
        {user ? (
          <>
            <span className="navbar-user">{user.name} ({user.role})</span>
            <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
