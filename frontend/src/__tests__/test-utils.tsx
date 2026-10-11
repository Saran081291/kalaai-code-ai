import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/context/auth-context';
import { createQueryClient } from '@/lib/queryClient';
import { theme } from '@/theme';
import type { User, UserRole } from '@/types';

/** Build a User fixture. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'thambi@example.com',
    fullName: 'Thambi Test',
    avatarUrl: null,
    role: 'student',
    defaultSpiceLevel: 'medium',
    isActive: true,
    isVerified: true,
    oauthProvider: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

/** Build a mock auth context value. Pass `user: null` for a signed-out session. */
export function makeAuthValue(
  user: User | null = null,
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  const resolveUser = (): Promise<User> => Promise.resolve(user ?? makeUser());
  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
    login: vi.fn(resolveUser),
    register: vi.fn(resolveUser),
    loginWithTokens: vi.fn(resolveUser),
    logout: vi.fn(() => Promise.resolve()),
    updateProfile: vi.fn(resolveUser),
    refreshUser: vi.fn(() => Promise.resolve(user)),
    ...overrides,
  };
}

interface ProvidersOptions {
  route?: string;
  /** Signed-in user shorthand: a role or a full User. Omit for signed out. */
  as?: UserRole | User;
  /** Full control over the auth context (overrides `as`). */
  auth?: AuthContextValue;
}

/** Render with Chakra theme, a fresh QueryClient, a mock AuthContext and a MemoryRouter. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', as, auth, ...options }: ProvidersOptions & Omit<RenderOptions, 'wrapper'> = {},
): RenderResult {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });

  const user = as === undefined ? null : typeof as === 'string' ? makeUser({ role: as }) : as;
  const authValue = auth ?? makeAuthValue(user);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={client}>
          <AuthContext.Provider value={authValue}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>
      </ChakraProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
