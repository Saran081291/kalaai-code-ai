import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  /** Allowed roles; admins always pass. Omit to allow any signed-in user. */
  roles?: UserRole[];
  children?: ReactNode;
}

/** Redirects to /login when signed out, and to /dashboard when the role is not allowed. */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen text="Konjam wait pannunga, login check panren..." />;
  }
  if (!user) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}
