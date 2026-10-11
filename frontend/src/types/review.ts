import type { ISODateString } from './common';
import type { IssueCategory, IssueSeverity } from './enums';

export interface ReviewIssue {
  file: string;
  line: number | null;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  suggestion: string;
}

export interface ReviewCriterionScore {
  id: number;
  reviewId: number;
  criterionId: number;
  score: number;
  feedback: string;
  /* Convenience fields joined from RubricCriterion. */
  criterionName?: string;
  maxPoints?: number;
}

export interface Review {
  id: number;
  submissionId: number;
  totalScore: number;
  summary: string;
  strengths: string[];
  issues: ReviewIssue[];
  criterionScores: ReviewCriterionScore[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  instructorOverrideScore: number | null;
  instructorComment: string | null;
  /** `instructorOverrideScore ?? totalScore` (PRP contract #7). */
  effectiveScore: number;
  maxScore?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Body for PUT /reviews/{id}/override. `overrideScore: null` clears the override. */
export interface ReviewOverrideRequest {
  overrideScore: number | null;
  comment?: string | null;
}
