const bcrypt = require('bcryptjs');
const { sequelize, User, DoctorProfile } = require('../models');

const DEFAULT_HOURS = {
  mon: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '13:00' }],
  sat: [],
  sun: [],
};

async function upsertUser({ name, email, password, role, phone }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: { name, email, passwordHash, role, phone },
  });
  return user;
}

async function seed() {
  await sequelize.authenticate();
  console.log('[seed] Connected. Seeding...');

  const admin = await upsertUser({
    name: 'Clinic Admin',
    email: 'admin@clinic.example.com',
    password: 'Admin@123',
    role: 'admin',
    phone: '+91-9000000000',
  });

  const doctorUser1 = await upsertUser({
    name: 'Dr. Asha Mehta',
    email: 'asha.mehta@clinic.example.com',
    password: 'Doctor@123',
    role: 'doctor',
    phone: '+91-9000000001',
  });
  await DoctorProfile.findOrCreate({
    where: { userId: doctorUser1.id },
    defaults: {
      userId: doctorUser1.id,
      specialization: 'General Physician',
      bio: 'MBBS, MD - 12 years of experience in general medicine.',
      workingHours: DEFAULT_HOURS,
      slotDurationMinutes: 20,
    },
  });

  const doctorUser2 = await upsertUser({
    name: 'Dr. Rohan Kapoor',
    email: 'rohan.kapoor@clinic.example.com',
    password: 'Doctor@123',
    role: 'doctor',
    phone: '+91-9000000002',
  });
  await DoctorProfile.findOrCreate({
    where: { userId: doctorUser2.id },
    defaults: {
      userId: doctorUser2.id,
      specialization: 'Cardiologist',
      bio: 'MD, DM Cardiology - 8 years of experience.',
      workingHours: DEFAULT_HOURS,
      slotDurationMinutes: 30,
    },
  });

  const patient = await upsertUser({
    name: 'Sukant Jha',
    email: 'patient@example.com',
    password: 'Patient@123',
    role: 'patient',
    phone: '+91-9000000099',
  });

  console.log('[seed] Done.');
  console.log('----------------------------------------------------');
  console.log('Admin login:   admin@clinic.example.com / Admin@123');
  console.log('Doctor login:  asha.mehta@clinic.example.com / Doctor@123');
  console.log('Doctor login:  rohan.kapoor@clinic.example.com / Doctor@123');
  console.log('Patient login: patient@example.com / Patient@123');
  console.log('----------------------------------------------------');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
