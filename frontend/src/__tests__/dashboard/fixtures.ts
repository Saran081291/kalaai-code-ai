import type { InstructorDashboard, StudentDashboard, Submission } from '@/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function isoFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 101,
    assignmentId: 11,
    studentId: 1,
    attemptNumber: 1,
    sourceType: 'github',
    githubUrl: 'https://github.com/thambi/fizzbuzz',
    commitSha: null,
    spiceLevel: 'medium',
    status: 'completed',
    errorMessage: null,
    isLate: false,
    submittedAt: isoFromNow(-2 * HOUR),
    createdAt: isoFromNow(-2 * HOUR),
    updatedAt: isoFromNow(-2 * HOUR),
    studentName: 'Thambi Test',
    assignmentTitle: 'FizzBuzz Deluxe',
    courseId: 7,
    courseName: 'Python Basics',
    effectiveScore: 82,
    maxScore: 100,
    ...overrides,
  };
}

export function makeStudentDashboard(overrides: Partial<StudentDashboard> = {}): StudentDashboard {
  return {
    role: 'student',
    upcomingAssignments: [
      {
        id: 11,
        title: 'Linked List Lab',
        courseId: 7,
        courseName: 'Python Basics',
        dueDate: isoFromNow(5 * HOUR),
        attemptsUsed: 1,
        maxAttempts: 3,
      },
      {
        id: 12,
        title: 'Sorting Showdown',
        courseId: 7,
        courseName: 'Python Basics',
        dueDate: isoFromNow(2 * DAY),
        attemptsUsed: 0,
        maxAttempts: 2,
      },
      {
        id: 13,
        title: 'Graph Gauntlet',
        courseId: 8,
        courseName: 'DSA in Java',
        dueDate: isoFromNow(10 * DAY),
        attemptsUsed: 2,
        maxAttempts: 2,
      },
    ],
    recentResults: [
      makeSubmission(),
      makeSubmission({
        id: 102,
        assignmentTitle: 'Recursion Rumble',
        status: 'reviewing',
        effectiveScore: null,
        spiceLevel: 'mass',
      }),
    ],
    ranks: [
      { courseId: 7, courseName: 'Python Basics', rank: 3, totalStudents: 25, totalScore: 245 },
      { courseId: 8, courseName: 'DSA in Java', rank: null, totalStudents: 12, totalScore: 0 },
    ],
    ...overrides,
  };
}

export function makeInstructorDashboard(overrides: Partial<InstructorDashboard> = {}): InstructorDashboard {
  return {
    role: 'instructor',
    recentSubmissions: [
      makeSubmission({ id: 201, studentName: 'Meena', assignmentTitle: 'FizzBuzz Deluxe' }),
      makeSubmission({ id: 202, studentName: 'Karthik', assignmentTitle: 'Sorting Showdown', status: 'pending', effectiveScore: null }),
    ],
    failedSubmissions: [
      makeSubmission({
        id: 301,
        studentName: 'Pandi',
        assignmentTitle: 'Graph Gauntlet',
        status: 'failed',
        effectiveScore: null,
        errorMessage: 'GitHub repo kaanom',
      }),
    ],
    courseStats: [
      { courseId: 7, courseName: 'Python Basics', studentCount: 25, assignmentCount: 4, submissionCount: 60, inProgressCount: 2 },
      { courseId: 8, courseName: 'DSA in Java', studentCount: 12, assignmentCount: 3, submissionCount: 20, inProgressCount: 1 },
    ],
    ...overrides,
  };
}
