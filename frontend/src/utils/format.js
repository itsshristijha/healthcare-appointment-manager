// Doctor names entered by admin may or may not already include a "Dr."
// prefix (e.g. "Dr. Asha Mehta" vs "Asha Mehta"). Normalize so we never
// show "Dr. Dr. ...".
export function doctorDisplayName(name) {
  if (!name) return '';
  return /^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
}
