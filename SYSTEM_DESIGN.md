# System Design Write-up

## Double-booking prevention

The authoritative guard is a **partial unique index** on `appointments(doctor_id, slot_start) WHERE status IN ('pending','confirmed')`. Two requests can pass every application-level check (slot search, hold validation) at the same instant, but only one `INSERT` can win the index — Postgres itself serializes the race. The loser's insert throws `SequelizeUniqueConstraintError`, which the central error handler turns into a `409 Conflict` telling the patient the slot was just taken. This means correctness does not depend on the application server being single-instance, holding a lock, or getting timing right — it holds even under multiple backend replicas or horizontal scaling, which an in-memory lock or a naive "check-then-insert" would not survive.

The index is *partial* (scoped to non-terminal statuses) rather than a plain unique constraint so that a cancelled appointment frees the slot for reuse — a plain unique index would permanently sterilize any slot that was ever booked and cancelled once.

Booking itself runs inside a Sequelize transaction that creates the `Appointment` row and deletes the `SlotHold` atomically, so a crash mid-request can't leave an orphaned hold sitting on a slot that's actually booked.

## Slot hold mechanism

The unique index alone stops two *confirmed* bookings from colliding, but it does nothing while a patient is mid-flow: filling in the symptom form, thinking, or on a slow connection. Without something in between, two patients could both see a slot as "available," both start the multi-step booking UI, and only one would discover the conflict — after typing out their symptoms — at the final confirm step. That's a poor experience for something that's supposed to feel instant.

`POST /appointments/hold` creates a `SlotHold` row the moment a patient taps a slot, with a short TTL (`SLOT_HOLD_TTL_MINUTES`, default 5) and its own unique index on `(doctor_id, slot_start)`. The slot-search endpoint excludes any slot with an unexpired hold, so the second patient never even sees it as pickable — they get pushed to a different slot before investing time in the symptom form. `POST /appointments/confirm` re-validates the hold hasn't expired and re-checks doctor leave (in case admin marked leave in the interim) before creating the real appointment. An expired hold is treated as free by every read path and is swept up by a once-a-minute cleanup job; the TTL, not the cleanup job, is what actually prevents starvation, so the mechanism degrades gracefully even if the cron job is delayed.

The hold is a UX optimization, not the correctness boundary — that's still the database index above — so a bug or bypass in hold logic can only produce a slightly worse experience (an occasional late 409), never an actual double-booking.

## Doctor leave conflict handling

Leave is deliberately not just a write-time block ("you can't book on a leave day") but also a **reactive cancellation**: `POST /admin/doctors/:id/leave` first inserts the `DoctorLeave` row, then in the same request queries every still-active (`pending`/`confirmed`) appointment for that doctor on that date, and for each one: marks it `cancelled` with an explanatory reason, deletes both calendar events (best-effort — a calendar failure doesn't block the cancellation), and queues a cancellation email to the patient explaining why. The whole affected set and notified list is returned to the admin UI so the action's blast radius is visible immediately, not discovered later as a support ticket.

Future bookings are blocked at two points for defense in depth: the slot-listing endpoint short-circuits and returns no slots for a leave date, and both `hold` and `confirm` re-check leave server-side — so a stale client can't book around a leave day it fetched before the leave was added.

## Notification failure handling

Every outbound email is durable *before* it's attempted: `sendEmail()` first writes a `NotificationLog` row with `status: pending`, then attempts the send, then updates that same row to `sent` or `failed`. If the process crashes between those steps, the row survives as evidence of an attempt that needs following up, rather than a notification silently vanishing.

A failed send increments `retryCount` and schedules `nextRetryAt` using exponential backoff (1, 2, 4, 8... minutes), capped at `NOTIFICATION_MAX_RETRIES` (default 5), after which the row is marked `permanently_failed` instead of retried forever — surfaced in the admin Notification Log for manual follow-up rather than an endless silent retry loop. A cron job (`notificationRetryJob`, default every 10 minutes) sweeps up any `failed` row whose backoff window has elapsed and re-attempts it via the exact same `attemptSend` path used on the first try, so there's only one code path to reason about for "did this notification eventually go out." Because the log write happens independently of booking/cancellation succeeding, a flaky SMTP provider degrades notification delivery, never the appointment operation itself.
