import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import PatientDashboard from './pages/patient/PatientDashboard';
import BookAppointment from './pages/patient/BookAppointment';
import MedicationReminders from './pages/patient/MedicationReminders';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorLeave from './pages/doctor/DoctorLeave';
import AdminDashboard from './pages/admin/AdminDashboard';
import NotificationLogs from './pages/admin/NotificationLogs';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/patient/login" element={<Login expectedRole="patient" />} />
          <Route path="/doctor/login" element={<Login expectedRole="doctor" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/settings" element={<ProtectedRoute roles={['patient', 'doctor']}><Settings /></ProtectedRoute>} />

          <Route path="/patient" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/book" element={<ProtectedRoute roles={['patient']}><BookAppointment /></ProtectedRoute>} />
          <Route path="/patient/medications" element={<ProtectedRoute roles={['patient']}><MedicationReminders /></ProtectedRoute>} />

          <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/leave" element={<ProtectedRoute roles={['doctor']}><DoctorLeave /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute roles={['admin']}><NotificationLogs /></ProtectedRoute>} />

          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
