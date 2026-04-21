/** Parses "HH:mm" or "HH:mm:ss" to minutes since midnight (ignores fractional seconds). */
export function timeStringToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
