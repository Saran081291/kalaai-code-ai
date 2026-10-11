import type { ISODateString } from '@/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parse(iso: ISODateString | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO string → value for `<input type="datetime-local">` (local time, minute precision). */
export function toDateTimeLocal(iso: ISODateString | null | undefined): string {
  const date = parse(iso);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/** `datetime-local` value (local time) → ISO-8601 string with timezone (UTC "Z"), or null when empty/invalid. */
export function fromDateTimeLocal(value: string): ISODateString | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isPast(iso: ISODateString | null | undefined, now: Date = new Date()): boolean {
  const date = parse(iso);
  return date !== null && date.getTime() < now.getTime();
}

/** e.g. "Tue, 14 Oct 2026, 11:59 pm" in the user's locale. */
export function formatDateTime(iso: ISODateString | null | undefined): string {
  const date = parse(iso);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** e.g. "14 Oct 2026". */
export function formatDate(iso: ISODateString | null | undefined): string {
  const date = parse(iso);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** e.g. "in 3 days" / "2 hours ago". */
export function formatRelative(iso: ISODateString | null | undefined, now: Date = new Date()): string {
  const date = parse(iso);
  if (!date) return '';
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return rtf.format(0, 'minute');
}
