import type { Course, LeaderboardEntry, Page, PublicRoast, ReactionSummary, RoastWallItem } from '@/types';

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 5,
    instructorId: 99,
    name: 'Python Basics',
    description: null,
    joinCode: 'ABC123',
    isArchived: false,
    isInstructor: false,
    studentCount: 10,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function makeWallItem(overrides: Partial<RoastWallItem> = {}): RoastWallItem {
  return {
    id: 1,
    punchline: 'Un code-a paatha Meenakshi Amman-e shock aagiduvaanga!',
    content: 'Line 1: variable name "x".\nLine 2: idhu enna logic thambi?',
    spiceLevel: 'mass',
    studentName: 'Karthik Raja',
    studentAvatarUrl: null,
    assignmentTitle: 'FizzBuzz',
    effectiveScore: 42,
    maxScore: 50,
    reactionCounts: { fire: 3, laugh: 2, skull: 0, clap: 1 },
    myReactions: [],
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

export function makePage<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, page: 1, pageSize: 12, ...overrides };
}

export function makeSummary(overrides: Partial<ReactionSummary> = {}): ReactionSummary {
  return {
    roastId: 1,
    reactionCounts: { fire: 3, laugh: 2, skull: 0, clap: 1 },
    myReactions: [],
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank: 1,
    studentId: 100,
    studentName: 'Student',
    avatarUrl: null,
    totalScore: 90,
    assignmentsCompleted: 3,
    ...overrides,
  };
}

export function makePublicRoast(overrides: Partial<PublicRoast> = {}): PublicRoast {
  return {
    punchline: 'Indha code-ku Jigarthanda kudutha kooda sweet aagadhu!',
    spiceLevel: 'medium',
    effectiveScore: 31,
    maxScore: 50,
    studentFirstName: 'Priya',
    ...overrides,
  };
}

/** Minimal axios-like error that the api helpers (getErrorStatus/getErrorCode) understand. */
export function makeApiError(status: number, code: string, detail = 'Error'): Error {
  const error = Object.assign(new Error(detail), {
    isAxiosError: true,
    response: { status, data: { detail, code } },
    toJSON: () => ({}),
  });
  return error;
}
