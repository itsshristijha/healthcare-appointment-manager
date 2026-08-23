-- Reference schema (Postgres). The app creates this automatically via
-- Sequelize sync (`npm run migrate` in backend/) — this file exists purely
-- as human-readable documentation of the resulting shape.

CREATE TYPE enum_users_role AS ENUM ('patient', 'doctor', 'admin');

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR NOT NULL,
  email               VARCHAR NOT NULL UNIQUE,
  password_hash       VARCHAR NOT NULL,
  role                enum_users_role NOT NULL DEFAULT 'patient',
  phone               VARCHAR,
  google_refresh_token TEXT,               -- set after Google OAuth consent
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE doctor_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization        VARCHAR NOT NULL,
  bio                   TEXT,
  working_hours         JSONB NOT NULL DEFAULT '{}',  -- {"mon":[{"start":"09:00","end":"13:00"}], ...}
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL
);

CREATE TABLE doctor_leaves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  reason     VARCHAR,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (doctor_id, date)
);

-- Short-lived reservation created the moment a patient starts checking out
-- a slot. See SYSTEM_DESIGN.md for why this exists alongside the unique
-- index on appointments.
CREATE TABLE slot_holds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_start  TIMESTAMPTZ NOT NULL,
  slot_end    TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (doctor_id, slot_start)
);

CREATE TYPE enum_appointments_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

CREATE TABLE appointments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               UUID NOT NULL REFERENCES users(id),
  doctor_id                UUID NOT NULL REFERENCES doctor_profiles(id),
  slot_start               TIMESTAMPTZ NOT NULL,
  slot_end                 TIMESTAMPTZ NOT NULL,
  status                   enum_appointments_status NOT NULL DEFAULT 'pending',
  cancel_reason            VARCHAR,

  symptom_text             TEXT,
  pre_visit_summary        JSONB,   -- {urgencyLevel, chiefComplaint, suggestedQuestions[], generatedBy, generatedAt, degraded?, error?}

  post_visit_notes         TEXT,
  prescription             JSONB,   -- [{medication, dosage, frequencyPerDay, durationDays, instructions}]
  post_visit_summary       JSONB,   -- {summaryText, medicationSchedule, followUpSteps, generatedBy, generatedAt, degraded?, error?}

  calendar_event_id_patient VARCHAR,
  calendar_event_id_doctor  VARCHAR,

  created_at               TIMESTAMPTZ NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL
);

-- The core double-booking guard: only one non-cancelled appointment may
-- occupy a given doctor+slot at a time. A cancelled slot frees up again.
CREATE UNIQUE INDEX uniq_active_doctor_slot
  ON appointments (doctor_id, slot_start)
  WHERE status IN ('pending', 'confirmed');

CREATE TABLE medication_reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  medication_name   VARCHAR NOT NULL,
  dosage            VARCHAR,
  frequency_per_day INTEGER NOT NULL DEFAULT 1,
  times_of_day      JSONB NOT NULL DEFAULT '[]',  -- e.g. ["09:00","21:00"]
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  last_sent_at      TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL
);

CREATE TYPE enum_notification_logs_type AS ENUM (
  'booking_confirmation', 'reminder', 'cancellation', 'leave_notice', 'medication_reminder'
);
CREATE TYPE enum_notification_logs_status AS ENUM ('pending', 'sent', 'failed', 'permanently_failed');

CREATE TABLE notification_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              enum_notification_logs_type NOT NULL,
  channel           VARCHAR NOT NULL DEFAULT 'email',
  recipient_email   VARCHAR NOT NULL,
  recipient_user_id UUID,
  appointment_id    UUID REFERENCES appointments(id),
  subject           VARCHAR NOT NULL,
  body              TEXT NOT NULL,
  status            enum_notification_logs_status NOT NULL DEFAULT 'pending',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  next_retry_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL
);
