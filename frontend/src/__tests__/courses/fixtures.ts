import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import type { Assignment, Course, RubricCriterion } from '@/types';

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 7,
    instructorId: 99,
    name: 'Python Basics',
    description: 'Learn Python the Madurai way',
    joinCode: 'ABCD1234',
    isArchived: false,
    isInstructor: false,
    studentCount: 12,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function makeCriterion(overrides: Partial<RubricCriterion> = {}): RubricCriterion {
  return {
    id: 1,
    assignmentId: 11,
    name: 'Correctness',
    description: 'Works for all inputs',
    maxPoints: 50,
    position: 0,
    ...overrides,
  };
}

export function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 11,
    courseId: 7,
    createdBy: 99,
    title: 'FizzBuzz',
    description: 'Write FizzBuzz.\n\n- Use a loop',
    language: 'python',
    dueDate: '2099-01-01T10:00:00Z',
    maxScore: 100,
    maxAttempts: 3,
    allowLate: false,
    isPublished: true,
    rubricCriteria: [
      makeCriterion({ id: 1, name: 'Correctness', maxPoints: 60, position: 0 }),
      makeCriterion({ id: 2, name: 'Style', maxPoints: 40, position: 1 }),
    ],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

/** Build an axios error carrying an ApiError body. */
export function apiError(status: number, code: string, detail = 'Request failed'): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = {
    data: { detail, code },
    status,
    statusText: String(status),
    headers: {},
    config,
  };
  return new AxiosError(detail, AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}
