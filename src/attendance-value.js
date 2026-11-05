// Legacy zeroes can mean missing data or actual zero attendance; show both as unavailable.
export function attendanceValue(row, metric) {
  const raw = row?.[metric];
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
