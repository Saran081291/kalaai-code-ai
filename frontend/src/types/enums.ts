/**
 * Shared enums — string values MUST match backend `models/enums.py` (PRP cross-cutting contract #3).
 * Each enum is a string-literal union plus a readonly tuple of all values (handy for selects/validation).
 */

export const USER_ROLES = ['student', 'instructor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a user may pick at registration (`admin` is rejected by the API). */
export type RegisterableRole = Exclude<UserRole, 'admin'>;

export const PROGRAMMING_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
  'c',
  'cpp',
  'other',
] as const;
export type ProgrammingLanguage = (typeof PROGRAMMING_LANGUAGES)[number];

export const SOURCE_TYPES = ['github', 'upload'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SPICE_LEVELS = ['mild', 'medium', 'mass'] as const;
export type SpiceLevel = (typeof SPICE_LEVELS)[number];

export const SUBMISSION_STATUSES = [
  'pending',
  'fetching',
  'reviewing',
  'roasting',
  'completed',
  'failed',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses after which polling should stop. */
export const TERMINAL_SUBMISSION_STATUSES: readonly SubmissionStatus[] = ['completed', 'failed'];

export const ISSUE_SEVERITIES = ['critical', 'major', 'minor', 'nit'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_CATEGORIES = ['bug', 'security', 'quality', 'performance', 'style', 'testing'] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const REACTION_TYPES = ['fire', 'laugh', 'skull', 'clap'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export type OAuthProvider = 'google';
