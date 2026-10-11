import type { ISODateString } from './common';
import type { OAuthProvider, RegisterableRole, SpiceLevel, UserRole } from './enums';

export interface User {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  defaultSpiceLevel: SpiceLevel;
  isActive: boolean;
  isVerified: boolean;
  oauthProvider: OAuthProvider | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Response of /auth/login, /auth/register, /auth/refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: RegisterableRole;
}

/** Body for POST /auth/refresh and POST /auth/logout. */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Body for PUT /auth/me. */
export interface UpdateProfileRequest {
  fullName?: string | null;
  avatarUrl?: string | null;
  defaultSpiceLevel?: SpiceLevel;
}
