import type { ISODateString } from './common';
import type { Submission } from './submission';

/** Upcoming (published, not yet completed) assignment for a student. */
export interface UpcomingAssignment {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
  dueDate: ISODateString | null;
  attemptsUsed: number;
  maxAttempts: number;
}

/** The student's rank in one course leaderboard (`rank` null until they have a score). */
export interface CourseRank {
  courseId: number;
  courseName: string;
  rank: number | null;
  totalStudents: number;
  totalScore: number;
}

/** Per-course counts for instructors. */
export interface CourseStat {
  courseId: number;
  courseName: string;
  studentCount: number;
  assignmentCount: number;
  submissionCount: number;
  /** Submissions currently pending/fetching/reviewing/roasting. */
  inProgressCount: number;
}

export interface StudentDashboard {
  role: 'student';
  /** Next 5 by due date (nulls last). */
  upcomingAssignments: UpcomingAssignment[];
  /** Latest 5 submissions (denormalised fields populated). */
  recentResults: Submission[];
  ranks: CourseRank[];
}

/** Also returned to admins. */
export interface InstructorDashboard {
  role: 'instructor';
  /** Latest 10 submissions across the instructor's courses (denormalised). */
  recentSubmissions: Submission[];
  /** Submissions with status `failed` (denormalised), newest first, max 10. */
  failedSubmissions: Submission[];
  courseStats: CourseStat[];
}

/** GET /dashboard — discriminated by `role`. */
export type DashboardResponse = StudentDashboard | InstructorDashboard;
