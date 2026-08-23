const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToDate(baseDate, minutes) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Generate every possible slot start/end for one calendar date, from a
 * doctor's working-hours JSON and slot duration. Does not know about
 * existing bookings/holds/leave — callers filter those out separately.
 */
function generateSlotsForDate(workingHours, slotDurationMinutes, dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayKey = DAY_KEYS[date.getDay()];
  const ranges = workingHours[dayKey] || [];

  const slots = [];
  for (const range of ranges) {
    let cursor = toMinutes(range.start);
    const end = toMinutes(range.end);
    while (cursor + slotDurationMinutes <= end) {
      slots.push({
        start: minutesToDate(date, cursor),
        end: minutesToDate(date, cursor + slotDurationMinutes),
      });
      cursor += slotDurationMinutes;
    }
  }
  return slots;
}

module.exports = { generateSlotsForDate, DAY_KEYS };
