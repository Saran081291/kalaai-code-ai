import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/context/auth-context';

/** Access the auth session. Must be used inside `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
