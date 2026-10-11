import { createContext } from 'react';

import type { LoginRequest, RegisterRequest, TokenPair, UpdateProfileRequest, User } from '@/types';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** True while the initial session restore (GET /auth/me) is in flight. */
  isLoading: boolean;
  login: (body: LoginRequest) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  /** Store tokens obtained elsewhere (Google OAuth callback) and load the user. */
  loginWithTokens: (tokens: Pick<TokenPair, 'accessToken' | 'refreshToken'>) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (body: UpdateProfileRequest) => Promise<User>;
  refreshUser: () => Promise<User | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
