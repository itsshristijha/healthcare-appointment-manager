const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const doctorsRoutes = require('./routes/doctors');
const appointmentsRoutes = require('./routes/appointments');
const calendarRoutes = require('./routes/calendar');

const app = express();

app.use(cors({ origin: env.frontendUrl === '*' ? true : env.frontendUrl, credentials: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Healthcare Appointment & Follow-up Manager API',
    ok: true,
    health: '/api/health',
    frontend: env.frontendUrl,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    llmMocked: env.isLlmMocked,
    emailMocked: env.isEmailMocked,
    calendarMocked: env.isCalendarMocked,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/calendar', calendarRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

module.exports = app;
