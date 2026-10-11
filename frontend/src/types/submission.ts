import type { ISODateString } from './common';
import type { SourceType, SpiceLevel, SubmissionStatus } from './enums';

export interface Submission {
  id: number;
  assignmentId: number;
  studentId: number;
  attemptNumber: number;
  sourceType: SourceType;
  githubUrl: string | null;
  commitSha: string | null;
  spiceLevel: SpiceLevel;
  status: SubmissionStatus;
  errorMessage: string | null;
  isLate: boolean;
  submittedAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /* Denormalised fields included by list endpoints (instructor list, /submissions/me). */
  studentName?: string | null;
  assignmentTitle?: string;
  courseId?: number;
  courseName?: string;
  /** `instructorOverrideScore ?? totalScore`; null until reviewed. */
  effectiveScore?: number | null;
  maxScore?: number;
}

export interface SubmissionFile {
  id: number;
  submissionId: number;
  path: string;
  language: string | null;
  sizeBytes: number;
  content: string;
  createdAt: ISODateString;
}

/**
 * Fields for POST /assignments/{id}/submissions (sent as multipart/form-data).
 * Exactly one of `githubUrl` or `files` must be provided.
 */
export type SubmissionCreateInput =
  | { spiceLevel: SpiceLevel; githubUrl: string; files?: never }
  | { spiceLevel: SpiceLevel; files: File[]; githubUrl?: never };
