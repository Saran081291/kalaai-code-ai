import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext, type AuthContextValue } from '@/context/auth-context';
import { tokenStorage } from '@/lib/tokenStorage';
import { setAuthFailureHandler } from '@/services/api';
import { authService } from '@/services/authService';
import type { LoginRequest, RegisterRequest, TokenPair, UpdateProfileRequest, User } from '@/types';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => tokenStorage.hasTokens());

  const clearSession = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!tokenStorage.hasTokens()) {
      setUser(null);
      return null;
    }
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  // Restore session on first load.
  useEffect(() => {
    let cancelled = false;
    if (!tokenStorage.hasTokens()) {
      setIsLoading(false);
      return;
    }
    authService
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // When the API client gives up refreshing, drop local session state.
  useEffect(() => setAuthFailureHandler(() => setUser(null)), []);

  const loginWithTokens = useCallback(
    async (tokens: Pick<TokenPair, 'accessToken' | 'refreshToken'>): Promise<User> => {
      tokenStorage.setTokens(tokens);
      const me = await authService.me();
      setUser(me);
      return me;
    },
    [],
  );

  const login = useCallback(
    async (body: LoginRequest): Promise<User> => loginWithTokens(await authService.login(body)),
    [loginWithTokens],
  );

  const register = useCallback(
    async (body: RegisterRequest): Promise<User> =>
      loginWithTokens(await authService.register(body)),
    [loginWithTokens],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Token may already be revoked/expired — logging out locally is enough.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateProfile = useCallback(async (body: UpdateProfileRequest): Promise<User> => {
    const updated = await authService.updateMe(body);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      loginWithTokens,
      logout,
      updateProfile,
      refreshUser,
    }),
    [user, isLoading, login, register, loginWithTokens, logout, updateProfile, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
