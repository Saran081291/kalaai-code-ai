import type { User } from '@/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** First name for greetings: fullName → email local part → "thambi". */
export function getFirstName(user: Pick<User, 'fullName' | 'email'> | null | undefined): string {
  const fromName = user?.fullName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = user?.email?.split('@')[0];
  return fromEmail || 'thambi';
}

/** Tanglish line based on the hour of the day. */
export function getTimeOfDayLine(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Kaalaila filter coffee-oda code review-ah? Semma start! ☕';
  if (hour >= 12 && hour < 17) return 'Madhiyam saapadu aachaa? Code-ayum konjam paarunga 🍛';
  if (hour >= 17 && hour < 21) return 'Saayangaalam jigarthanda time — code-um cool-a irukkanum 🥤';
  return 'Raathiri late-a code panreengala? Bugs-um thoongaadhu 🌙';
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "in 3 hours", "2 days ago", "yesterday"... */
export function formatRelative(target: Date, now: Date = new Date()): string {
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE) return 'just now';
  if (abs < HOUR) return relativeFormatter.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return relativeFormatter.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return relativeFormatter.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return relativeFormatter.format(Math.round(diff / (30 * DAY)), 'month');
  return relativeFormatter.format(Math.round(diff / (365 * DAY)), 'year');
}

/** Relative time from an ISO string; falls back to the raw value when unparsable. */
export function formatRelativeIso(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatRelative(date, now);
}

/** Absolute, locale-formatted date (for tooltips / title attributes). */
export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export type DueUrgency = 'overdue' | 'urgent' | 'soon' | 'later' | 'none';

export interface DueInfo {
  label: string;
  urgency: DueUrgency;
  /** Chakra colorScheme for the due badge. */
  colorScheme: 'red' | 'orange' | 'green' | 'gray';
}

/** Due-date label + urgency: red < 24h (or overdue), orange < 3 days. */
export function getDueInfo(dueDate: string | null, now: Date = new Date()): DueInfo {
  if (!dueDate) return { label: 'No due date', urgency: 'none', colorScheme: 'gray' };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { label: 'No due date', urgency: 'none', colorScheme: 'gray' };

  const remaining = due.getTime() - now.getTime();
  const relative = formatRelative(due, now);
  if (remaining <= 0) return { label: `Overdue · ${relative}`, urgency: 'overdue', colorScheme: 'red' };
  if (remaining < DAY) return { label: `Due ${relative}`, urgency: 'urgent', colorScheme: 'red' };
  if (remaining < 3 * DAY) return { label: `Due ${relative}`, urgency: 'soon', colorScheme: 'orange' };
  return { label: `Due ${relative}`, urgency: 'later', colorScheme: 'green' };
}
