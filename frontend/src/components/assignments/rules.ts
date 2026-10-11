import type { Assignment } from '@/types';

import { isPast } from './dateUtils';

/** Why publishing is blocked (based on the SAVED assignment), or null when it's allowed. */
export function publishBlockReason(assignment: Assignment, hasUnsavedChanges = false): string | null {
  const criteria = assignment.rubricCriteria ?? [];
  const total = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  if (criteria.length === 0) return 'Add at least one rubric criterion and save the rubric first.';
  if (total !== assignment.maxScore) {
    return `Saved rubric total (${total}) must equal the max score (${assignment.maxScore}).`;
  }
  if (hasUnsavedChanges) return 'Save your changes before publishing.';
  return null;
}

/** Why the student can't submit right now, or null. */
export function submitBlockReason(assignment: Assignment, now: Date = new Date()): string | null {
  const used = assignment.myAttemptsCount ?? 0;
  if (used >= assignment.maxAttempts) {
    return `You've used all ${assignment.maxAttempts} attempts. Attempts mudinjiduchu — check your results in My submissions.`;
  }
  if (isPast(assignment.dueDate, now) && !assignment.allowLate) {
    return 'The due date has passed and late submissions are not allowed.';
  }
  if (!assignment.isPublished) return 'This assignment is not open for submissions yet.';
  return null;
}
