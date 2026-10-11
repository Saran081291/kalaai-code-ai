/** Route patterns (for <Route path>) and builders (for links/navigate). Keep in sync with App.tsx. */
export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  googleCallback: '/auth/google/callback',
  profile: '/profile',
  dashboard: '/dashboard',
  settings: '/settings',
  courses: '/courses',
  courseNew: '/courses/new',
  courseJoin: '/courses/join',
  courseDetail: '/courses/:id',
  assignmentNew: '/courses/:courseId/assignments/new',
  roastWall: '/courses/:id/roast-wall',
  leaderboard: '/courses/:id/leaderboard',
  assignmentDetail: '/assignments/:id',
  assignmentEdit: '/assignments/:id/edit',
  submit: '/assignments/:id/submit',
  assignmentSubmissions: '/assignments/:id/submissions',
  mySubmissions: '/submissions',
  submissionResult: '/submissions/:id',
  publicRoast: '/r/:slug',
} as const;

type Id = number | string;

export const paths = {
  courseDetail: (id: Id) => `/courses/${id}`,
  assignmentNew: (courseId: Id) => `/courses/${courseId}/assignments/new`,
  roastWall: (courseId: Id) => `/courses/${courseId}/roast-wall`,
  leaderboard: (courseId: Id) => `/courses/${courseId}/leaderboard`,
  assignmentDetail: (id: Id) => `/assignments/${id}`,
  assignmentEdit: (id: Id) => `/assignments/${id}/edit`,
  submit: (assignmentId: Id) => `/assignments/${assignmentId}/submit`,
  assignmentSubmissions: (assignmentId: Id) => `/assignments/${assignmentId}/submissions`,
  submissionResult: (id: Id) => `/submissions/${id}`,
  publicRoast: (slug: string) => `/r/${slug}`,
} as const;
