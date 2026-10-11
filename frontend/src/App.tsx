import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { ROUTES } from '@/lib/routes';
import { theme } from '@/theme';

// Public pages
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const GoogleCallbackPage = lazy(() => import('@/pages/GoogleCallbackPage'));
const PublicRoastPage = lazy(() => import('@/pages/PublicRoastPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// App pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const CoursesPage = lazy(() => import('@/pages/CoursesPage'));
const CourseCreatePage = lazy(() => import('@/pages/CourseCreatePage'));
const CourseJoinPage = lazy(() => import('@/pages/CourseJoinPage'));
const CourseDetailPage = lazy(() => import('@/pages/CourseDetailPage'));
const AssignmentCreatePage = lazy(() => import('@/pages/AssignmentCreatePage'));
const AssignmentDetailPage = lazy(() => import('@/pages/AssignmentDetailPage'));
const AssignmentEditPage = lazy(() => import('@/pages/AssignmentEditPage'));
const SubmitPage = lazy(() => import('@/pages/SubmitPage'));
const AssignmentSubmissionsPage = lazy(() => import('@/pages/AssignmentSubmissionsPage'));
const MySubmissionsPage = lazy(() => import('@/pages/MySubmissionsPage'));
const SubmissionResultPage = lazy(() => import('@/pages/SubmissionResultPage'));
const RoastWallPage = lazy(() => import('@/pages/RoastWallPage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path={ROUTES.landing} element={<LandingPage />} />
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.register} element={<RegisterPage />} />
          <Route path={ROUTES.googleCallback} element={<GoogleCallbackPage />} />
          <Route path={ROUTES.publicRoast} element={<PublicRoastPage />} />
        </Route>

        {/* Authenticated app */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedLayout />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
            <Route path={ROUTES.courses} element={<CoursesPage />} />
            <Route path={ROUTES.courseDetail} element={<CourseDetailPage />} />
            <Route path={ROUTES.roastWall} element={<RoastWallPage />} />
            <Route path={ROUTES.leaderboard} element={<LeaderboardPage />} />
            <Route path={ROUTES.assignmentDetail} element={<AssignmentDetailPage />} />
            <Route path={ROUTES.submissionResult} element={<SubmissionResultPage />} />

            <Route element={<ProtectedRoute roles={['instructor']} />}>
              <Route path={ROUTES.courseNew} element={<CourseCreatePage />} />
              <Route path={ROUTES.assignmentNew} element={<AssignmentCreatePage />} />
              <Route path={ROUTES.assignmentEdit} element={<AssignmentEditPage />} />
              <Route path={ROUTES.assignmentSubmissions} element={<AssignmentSubmissionsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route path={ROUTES.courseJoin} element={<CourseJoinPage />} />
              <Route path={ROUTES.submit} element={<SubmitPage />} />
              <Route path={ROUTES.mySubmissions} element={<MySubmissionsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
