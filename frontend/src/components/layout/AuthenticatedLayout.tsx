import { useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/routes';

/** AppShell bound to the signed-in user (role-based nav, name, avatar, logout). */
export function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <AppShell
      role={user?.role}
      userName={user?.fullName ?? user?.email}
      avatarUrl={user?.avatarUrl ?? undefined}
      onLogout={() => void handleLogout()}
    />
  );
}
