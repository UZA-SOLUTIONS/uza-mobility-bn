/**
 * Money is always RWF and always whole francs. There is no minor unit in
 * circulation, and a displayed decimal invites somebody to type one.
 */
export function rwf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `RWF ${Math.round(amount).toLocaleString('en-RW')}`;
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Counts down a hold. Returns "expired" rather than a negative number. */
export function countdown(until: string | Date, now = new Date()): string {
  const ms = (typeof until === 'string' ? new Date(until) : until).getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
