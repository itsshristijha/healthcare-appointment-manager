import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = { patient: '/patient', doctor: '/doctor', admin: '/admin' };

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Healthcare Appointment &amp; Follow-up Manager</h1>
        <p>
          Book appointments, get an AI pre-visit summary ready for your doctor, receive a
          plain-language post-visit summary, and stay on top of medication reminders — all with
          automatic email and calendar sync.
        </p>
        {user ? (
          <Link className="btn btn-primary" to={ROLE_HOME[user.role]}>Go to my dashboard</Link>
        ) : (
          <div className="home-actions">
            <Link className="btn btn-primary" to="/patient/login">Patient login</Link>
            <Link className="btn btn-secondary" to="/doctor/login">Doctor login</Link>
            <Link className="btn btn-secondary" to="/register">Register as a patient</Link>
          </div>
        )}
      </div>
    </div>
  );
}
