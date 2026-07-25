export function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === '') return 9999;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(-2147483648, Math.min(2147483647, Math.round(parsed)));
  }
  return 9999;
}
