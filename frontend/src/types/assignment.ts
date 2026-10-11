import type { ISODateString } from './common';
import type { ProgrammingLanguage } from './enums';

export interface RubricCriterion {
  id: number;
  assignmentId: number;
  name: string;
  description: string;
  maxPoints: number;
  position: number;
}

/** Criterion as sent to POST /courses/{id}/assignments and PUT /assignments/{id}/rubric. */
export interface RubricCriterionInput {
  name: string;
  description: string;
  maxPoints: number;
  position: number;
}

export interface Assignment {
  id: number;
  courseId: number;
  createdBy: number;
  title: string;
  /** Markdown. Render as text/markdown — never with dangerouslySetInnerHTML. */
  description: string;
  language: ProgrammingLanguage;
  dueDate: ISODateString | null;
  maxScore: number;
  maxAttempts: number;
  allowLate: boolean;
  isPublished: boolean;
  /** Present on GET /assignments/{id}; ordered by `position`. */
  rubricCriteria?: RubricCriterion[];
  /** Student only: number of attempts already used (GET /assignments/{id}). */
  myAttemptsCount?: number;
  /** Student only: the attempt number the next submission will get (can skip refunded failures). */
  myNextAttemptNumber?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AssignmentCreateRequest {
  title: string;
  description: string;
  language: ProgrammingLanguage;
  dueDate?: ISODateString | null;
  maxScore?: number;
  maxAttempts?: number;
  allowLate?: boolean;
  rubricCriteria?: RubricCriterionInput[];
}

export type AssignmentUpdateRequest = Partial<Omit<AssignmentCreateRequest, 'rubricCriteria'>>;

export interface RubricUpdateRequest {
  criteria: RubricCriterionInput[];
}
