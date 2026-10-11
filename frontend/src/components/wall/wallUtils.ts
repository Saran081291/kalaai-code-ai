import { getErrorCode, getErrorStatus } from '@/services/api';
import type { LeaderboardEntry, ReactionType, SpiceLevel } from '@/types';

/** Accent gradient per spice level (Chakra `bgGradient`). */
export const SPICE_GRADIENT: Record<SpiceLevel, string> = {
  mild: 'linear(to-r, spice.mild, spice.mildYellow)',
  medium: 'linear(to-r, spice.mildYellow, spice.medium)',
  mass: 'linear(to-r, spice.medium, spice.mass, maroon.500)',
};

export interface ReactionMeta {
  emoji: string;
  /** Used in the accessible label: "React fire (3)". */
  label: string;
}

export const REACTION_META: Record<ReactionType, ReactionMeta> = {
  fire: { emoji: '🔥', label: 'fire' },
  laugh: { emoji: '😂', label: 'laugh' },
  skull: { emoji: '💀', label: 'skull' },
  clap: { emoji: '👏', label: 'clap' },
};

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function medalFor(rank: number): string {
  return MEDALS[rank] ?? '🏅';
}

/** Ranks shared by more than one student. */
export function findTiedRanks(entries: readonly LeaderboardEntry[]): ReadonlySet<number> {
  const seen = new Set<number>();
  const tied = new Set<number>();
  for (const entry of entries) {
    if (seen.has(entry.rank)) tied.add(entry.rank);
    seen.add(entry.rank);
  }
  return tied;
}

export function isNotCourseMemberError(err: unknown): boolean {
  return getErrorCode(err) === 'NOT_COURSE_MEMBER' || getErrorStatus(err) === 403;
}

export function isNotFoundError(err: unknown): boolean {
  return getErrorStatus(err) === 404;
}

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday", "just now". */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const diffSeconds = Math.round((time - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit);
  }
  return formatter.format(Math.round(diffSeconds / 60), 'minute');
}
