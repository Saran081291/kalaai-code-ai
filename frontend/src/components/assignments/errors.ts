import { getErrorCode, getErrorMessage } from '@/services/api';

/** Clear English messages for the assignment-related API error codes (falls back to the API detail). */
const MESSAGES: Record<string, string> = {
  RUBRIC_TOTAL_MISMATCH: 'Rubric points must add up exactly to the max score.',
  HAS_SUBMISSIONS: 'Students have already submitted to this assignment, so this change is not allowed.',
  NOT_COURSE_OWNER: 'Only the course instructor can do this.',
  NOT_COURSE_MEMBER: "You're not a member of this course.",
  ROLE_REQUIRED: "Your account role doesn't allow this action.",
};

export function assignmentErrorMessage(err: unknown): string {
  const code = getErrorCode(err);
  return (code && MESSAGES[code]) || getErrorMessage(err);
}
