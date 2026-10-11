import type { ISODateString } from './common';

export interface Course {
  id: number;
  instructorId: number;
  name: string;
  description: string | null;
  joinCode: string;
  isArchived: boolean;
  /** True when the current user teaches this course (role flag from GET /courses). */
  isInstructor: boolean;
  studentCount?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CourseEnrollment {
  id: number;
  courseId: number;
  studentId: number;
  joinedAt: ISODateString;
}

/** Row of GET /courses/{id}/students (instructor only). */
export interface CourseStudent {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  joinedAt: ISODateString;
}

export interface CourseCreateRequest {
  name: string;
  description?: string | null;
}

export type CourseUpdateRequest = Partial<CourseCreateRequest>;

export interface CourseJoinRequest {
  joinCode: string;
}
