import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import type { Assignment, Review, Roast, Submission, SubmissionFile } from '@/types';

export const SUBMISSION_ID = 5;
export const STUDENT_ID = 1;

export function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: SUBMISSION_ID,
    assignmentId: 7,
    studentId: STUDENT_ID,
    attemptNumber: 2,
    sourceType: 'github',
    githubUrl: 'https://github.com/thambi/todo-app',
    commitSha: 'abcdef1234567',
    spiceLevel: 'medium',
    status: 'completed',
    errorMessage: null,
    isLate: false,
    submittedAt: '2026-10-05T10:00:00Z',
    createdAt: '2026-10-05T10:00:00Z',
    updatedAt: '2026-10-05T10:01:00Z',
    ...overrides,
  };
}

export function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 7,
    courseId: 3,
    createdBy: 99,
    title: 'Todo API',
    description: 'Build a todo API',
    language: 'python',
    dueDate: null,
    maxScore: 100,
    maxAttempts: 3,
    allowLate: false,
    isPublished: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 11,
    submissionId: SUBMISSION_ID,
    totalScore: 72,
    summary: 'Solid CRUD endpoints but validation is thin.',
    strengths: ['Clear route naming', 'Good use of type hints'],
    issues: [
      {
        file: 'app.py',
        line: 3,
        severity: 'major',
        category: 'bug',
        message: 'Division by zero when list is empty',
        suggestion: 'Guard against empty lists',
      },
      {
        file: 'utils.py',
        line: null,
        severity: 'nit',
        category: 'style',
        message: 'Inconsistent naming',
        suggestion: 'Use snake_case',
      },
    ],
    criterionScores: [
      { id: 1, reviewId: 11, criterionId: 1, score: 40, feedback: 'Works for main flows', criterionName: 'Correctness', maxPoints: 50 },
      { id: 2, reviewId: 11, criterionId: 2, score: 32, feedback: 'Readable', criterionName: 'Code Quality', maxPoints: 50 },
    ],
    modelUsed: 'claude',
    inputTokens: 100,
    outputTokens: 50,
    instructorOverrideScore: null,
    instructorComment: null,
    effectiveScore: 72,
    maxScore: 100,
    createdAt: '2026-10-05T10:01:00Z',
    updatedAt: '2026-10-05T10:01:00Z',
    ...overrides,
  };
}

export function makeRoast(overrides: Partial<Roast> = {}): Roast {
  return {
    id: 21,
    reviewId: 11,
    spiceLevel: 'medium',
    content: 'Enna thambi idhu? Divide by zero-a?\nAana routes gethu dhaan. Keep going!',
    punchline: 'Un code Vaigai aathu maari — full-a dry!',
    isHidden: false,
    isShared: false,
    shareSlug: null,
    regenerateCount: 1,
    createdAt: '2026-10-05T10:02:00Z',
    updatedAt: '2026-10-05T10:02:00Z',
    ...overrides,
  };
}

export function makeFiles(): SubmissionFile[] {
  return [
    {
      id: 101,
      submissionId: SUBMISSION_ID,
      path: 'src/app.py',
      language: 'python',
      sizeBytes: 60,
      content: 'def avg(xs):\n    total = sum(xs)\n    return total / len(xs)\n',
      createdAt: '2026-10-05T10:00:00Z',
    },
    {
      id: 102,
      submissionId: SUBMISSION_ID,
      path: 'src/utils.py',
      language: 'python',
      sizeBytes: 20,
      content: 'def helperFn():\n    pass\n',
      createdAt: '2026-10-05T10:00:00Z',
    },
  ];
}

/** An axios error with an HTTP status + ApiError body (what services throw). */
export function makeApiError(status: number, code: string, detail = 'Error'): AxiosError {
  const response = {
    status,
    statusText: String(status),
    data: { detail, code },
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError(detail, 'ERR_BAD_REQUEST', response.config, undefined, response);
}
