import { getErrorCode, getErrorMessage, getErrorStatus } from '@/services/api';

import { MAX_UPLOAD_FILES, MAX_UPLOAD_MB } from './uploadRules';

/** Friendly messages for submission API error codes (see phase2-contracts §2). */
export const SUBMISSION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ATTEMPT_LIMIT: 'You have used all your attempts for this assignment. Attempts ellam mudinjiduchu, thambi.',
  PAST_DUE: 'The due date has passed and this assignment does not accept late submissions.',
  INVALID_GITHUB_URL:
    'That GitHub URL is not valid. Use a public repository link like https://github.com/owner/repo.',
  UPLOAD_TOO_LARGE: `Your upload is too large — the total limit is ${MAX_UPLOAD_MB} MB.`,
  TOO_MANY_FILES: `Too many files — upload at most ${MAX_UPLOAD_FILES} files, or zip them into one .zip.`,
  UNSUPPORTED_FILE: 'One or more files have an unsupported type. Upload code files or a single .zip.',
  NOT_PUBLISHED: 'This assignment is not published yet.',
  NOT_COURSE_MEMBER: 'You need to join this course before submitting.',
};

const RATE_LIMITED = 'Too many submissions in a short time. Konjam break edunga — try again later.';

/** Map any submission-create error to a clear, user-facing message. */
export function getSubmissionErrorMessage(err: unknown): string {
  const code = getErrorCode(err);
  if (code) {
    const mapped = SUBMISSION_ERROR_MESSAGES[code];
    if (mapped) return mapped;
  }
  if (getErrorStatus(err) === 429) return RATE_LIMITED;
  return getErrorMessage(err);
}
