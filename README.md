# Healthcare Appointment & Follow-up Manager

A full-stack clinic platform with separate portals for **patients**, **doctors**, and an **admin**. Patients book appointments and describe symptoms in advance; an LLM produces a pre-visit summary with an urgency level for the doctor; after the visit, the doctor's clinical notes are turned into a plain-language summary for the patient. Both sides get email confirmations and Google Calendar events, kept in sync through reschedules and cancellations.

Runs **fully offline out of the box** — no OpenAI, SMTP, or Google credentials required. Every external integration has a pluggable mock so you can `npm install && npm run migrate && npm run seed && npm start` and see the whole product work end to end. Drop in real credentials later and the exact same code paths switch from mock to live automatically.

## Contents

- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [LLM prompts](#llm-prompts)
- [Google Calendar setup](#google-calendar-setup)
- [Email setup](#email-setup)
- [Docker](#docker)
- [Deployment](#deployment)
- [System design write-up](#system-design-write-up)

## Quick start

Requires Node.js 18+ and PostgreSQL 14+ (running locally, or via Docker — see [Docker](#docker)).

```bash
# 1. Create the database
createdb healthcare_appointments   # or: psql -c "CREATE DATABASE healthcare_appointments;"

# 2. Backend
cd backend
cp .env.example .env               # defaults work out of the box for local Postgres
npm install
npm run migrate                    # creates all tables
npm run seed                       # creates demo admin/doctor/patient accounts
npm start                          # http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                        # http://localhost:5173
```

Open `http://localhost:5173` and log in with one of the [demo accounts](#demo-accounts) below.

## Demo accounts

Created by `npm run seed` (backend):

| Role    | Email                              | Password     |
|---------|-------------------------------------|--------------|
| Admin   | `admin@clinic.example.com`          | `Admin@123`  |
| Doctor  | `asha.mehta@clinic.example.com`     | `Doctor@123` |
| Doctor  | `rohan.kapoor@clinic.example.com`   | `Doctor@123` |
| Doctor  | `priya.sharma@clinic.example.com`   | `Doctor@123` |
| Doctor  | `vikram.singh@clinic.example.com`   | `Doctor@123` |
| Patient | `patient@example.com`               | `Patient@123`|

Patients can also self-register from the app; doctor and admin accounts are created by an admin (`POST /api/admin/doctors`) so only the clinic controls who gets clinical/admin access.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list with comments. The important ones:

| Variable | Effect when set | Effect when unset |
|---|---|---|
| `DATABASE_URL` (or `DB_*`) | Connects to your Postgres | — required |
| `JWT_SECRET` | Signs auth tokens | Falls back to an insecure dev default — **set this in production** |
| `OPENAI_API_KEY` | Real OpenAI calls for both summaries | Deterministic rule-based mock summarizer |
| `SMTP_HOST` / `SMTP_*` | Real emails via that SMTP server | Emails logged to console + `NotificationLog`, nothing sent |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Real Google Calendar events (per-user OAuth) | Fake event IDs generated, logged to console |

## Architecture

```
frontend/   React (Vite) SPA — 3 role-based portals sharing one login
backend/    Express API — Sequelize (Postgres) — JWT auth
  src/
    models/     User, DoctorProfile, DoctorLeave, SlotHold, Appointment,
                MedicationReminder, NotificationLog
    routes/     auth, admin, doctors, appointments, calendar
    services/   llmService, emailService, calendarService (each mockable)
    jobs/       medicationReminderJob, notificationRetryJob, slotHoldCleanupJob
```

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for the reasoning behind double-booking prevention, the slot-hold mechanism, doctor-leave cascading cancellation, and notification retry/backoff.

## Database schema

Full reference at [`docs/schema.sql`](./docs/schema.sql). The schema is created automatically by `npm run migrate` (Sequelize `sync`); the SQL file is documentation, not something you need to run by hand.

Key relationships: `User` 1—1 `DoctorProfile` (for doctor accounts) · `DoctorProfile` 1—N `DoctorLeave` · `DoctorProfile` 1—N `Appointment` N—1 `User` (patient) · `Appointment` 1—N `MedicationReminder` · `Appointment` 1—N `NotificationLog`.

## API reference

All routes are under `/api`. Authenticated routes expect `Authorization: Bearer <jwt>`.

**Auth**
- `POST /auth/register` `{name,email,password,phone}` → patient self-registration
- `POST /auth/login` `{email,password}`
- `GET /auth/me`

**Doctors (any authenticated user)**
- `GET /doctors?specialization=&q=` — search
- `GET /doctors/specializations`
- `GET /doctors/:id`
- `GET /doctors/:id/slots?date=YYYY-MM-DD` — available slots (excludes booked, held, and leave days)
- `GET /doctors/:id/leave` — upcoming leave days (read-only)

**Appointments**
- `POST /appointments/hold` `{doctorId,slotStart,slotEnd}` — patient only; short-lived reservation
- `POST /appointments/confirm` `{holdId,symptomText}` — patient only; generates pre-visit AI summary, creates the appointment, calendar events, and confirmation emails
- `GET /appointments/mine` — patient's own appointments
- `GET /appointments/doctor?date=YYYY-MM-DD` — doctor's own appointments
- `GET /appointments/:id`
- `POST /appointments/:id/cancel` `{reason?}` — patient, doctor, or admin
- `POST /appointments/:id/post-visit` `{notes,prescription:[...]}` — doctor only; generates post-visit AI summary, creates medication reminders, marks appointment completed
- `GET /appointments/medication/mine` — patient's medication reminders

**Admin**
- `GET/POST/PUT/DELETE /admin/doctors[/:id]` — doctor profile CRUD (specialization, working hours, slot duration)
- `POST /admin/doctors/:id/leave` `{date,reason}` — marks leave **and** cascades: cancels + emails affected patients
- `DELETE /admin/doctors/:id/leave/:date`
- `GET /admin/doctors/:id/leave`
- `GET /admin/notifications?status=` — notification delivery log

**Calendar**
- `GET /calendar/oauth/start` — returns the Google consent URL (real mode only)
- `GET /calendar/oauth/callback` — OAuth redirect target
- `GET /calendar/status` — whether this user has connected Google Calendar

## LLM prompts

Exactly as specified in the brief, sent verbatim to the model (see `backend/src/services/llmService.js`):

- **Pre-visit summary:** `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>`
- **Post-visit summary:** `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>`

Both are wrapped with a system prompt instructing strict-JSON output, parsed, and normalized into the same shape the mock summarizer returns — the rest of the app never knows which path produced a summary. If the API call or JSON parse fails for any reason, the error is logged, the response is degraded to the rule-based mock (flagged with `degraded: true` in the stored summary), and the request still succeeds — an LLM outage never blocks booking or note submission.

## Google Calendar setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Calendar API**.
2. Create an **OAuth 2.0 Client ID** (type: Web application). Add `http://localhost:4000/api/calendar/oauth/callback` (or your deployed backend URL + that path) as an authorized redirect URI.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `backend/.env`.
4. Each user (patient/doctor) connects their own calendar once via `GET /api/calendar/oauth/start` (wire a "Connect Google Calendar" button to this in the frontend `Settings` area — the route and token storage are already implemented). Their refresh token is stored on their `User` row and used for all future event create/update/delete calls.
5. Until a user connects, their events are created in mock mode (a fake event ID, logged to console) even if the app-wide credentials above are set — this is per-user, not global.

## Email setup

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` in `backend/.env` for any standard SMTP provider (SendGrid, Mailgun, Gmail SMTP, etc. all work via Nodemailer). Leave `SMTP_HOST` blank to keep running in mock mode — emails are logged to the console and to the `NotificationLog` table (visible in the admin **Notifications** page) instead of actually being sent.

## Docker

```bash
docker compose up --build
# Postgres on :5432, API on :4000, frontend on :5173
docker compose exec backend npm run seed   # optional, first run only
```

Copy `.env` values into a `.env` file next to `docker-compose.yml` (or export them) to enable real LLM/email/calendar integrations; unset variables default to mock mode as described above.

## Deployment

`render.yaml` in the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) that provisions a free Postgres instance, the backend API, and a static frontend build in one click (New → Blueprint → point at this repo). Add real API keys under the backend service's Environment tab after the first deploy if you want live LLM/email/calendar instead of the built-in mocks. The same `backend/Dockerfile` and `frontend/Dockerfile` also work unmodified on Railway, Fly.io, or any other container host — set the same environment variables described above.

## System design write-up

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md).
