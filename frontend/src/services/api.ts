import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL } from '@/lib/env';
import { tokenStorage } from '@/lib/tokenStorage';
import type { ApiError, TokenPair } from '@/types';

export { API_BASE_URL };

/** Endpoints where a 401 means "bad credentials", not "expired access token". */
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

const LOGIN_PATH = '/login';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type AuthFailureHandler = () => void;

let authFailureHandler: AuthFailureHandler | null = null;

/**
 * Lets AuthContext react (e.g. clear user state) when the session cannot be refreshed.
 * Returns an unsubscribe function.
 */
export function setAuthFailureHandler(handler: AuthFailureHandler | null): () => void {
  authFailureHandler = handler;
  return () => {
    if (authFailureHandler === handler) authFailureHandler = null;
  };
}

/** Shared axios instance — base URL `${VITE_API_URL}/api/v1`. */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/** In-flight refresh; concurrent 401s in this tab await this same promise (request queue). */
let refreshPromise: Promise<string> | null = null;

const REFRESH_LOCK_NAME = 'kalaai-refresh';

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  // Plain axios (not `api`) so this call bypasses the interceptors.
  const { data } = await axios.post<TokenPair>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  tokenStorage.setTokens(data);
  return data.accessToken;
}

/**
 * Runs inside the cross-tab lock. If another tab already rotated the tokens while this
 * request was failing (stored access token differs from the one it sent), reuse them —
 * re-sending the old refresh token would trip server-side reuse detection.
 */
async function refreshUnlocked(staleAccessToken: string | null): Promise<string> {
  const current = tokenStorage.getAccessToken();
  if (current && current !== staleAccessToken) return current;
  return requestNewAccessToken();
}

function refreshAccessToken(staleAccessToken: string | null): Promise<string> {
  if (!refreshPromise) {
    const run = (): Promise<string> => refreshUnlocked(staleAccessToken);
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const pending: Promise<string> = locks
      ? locks.request(REFRESH_LOCK_NAME, run)
      : run();
    refreshPromise = pending.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isNoRefreshEndpoint(url: string | undefined): boolean {
  return url !== undefined && NO_REFRESH_ENDPOINTS.some((path) => url.includes(path));
}

function handleAuthFailure(): void {
  tokenStorage.clearTokens();
  authFailureHandler?.();
  if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original: RetriableRequestConfig = error.config;
    if (original._retry || isNoRefreshEndpoint(original.url)) {
      return Promise.reject(error);
    }
    original._retry = true;

    // Another request may already have refreshed the token while this one was in flight.
    const currentToken = tokenStorage.getAccessToken();
    const sentAuthHeader = original.headers.get('Authorization');
    if (currentToken && sentAuthHeader !== `Bearer ${currentToken}`) {
      original.headers.set('Authorization', `Bearer ${currentToken}`);
      return api(original);
    }

    try {
      const newToken = await refreshAccessToken(
        typeof sentAuthHeader === 'string' ? sentAuthHeader.replace(/^Bearer /, '') : null,
      );
      original.headers.set('Authorization', `Bearer ${newToken}`);
      return api(original);
    } catch {
      handleAuthFailure();
      return Promise.reject(error);
    }
  },
);

const FALLBACK_ERROR = 'Edho thappu nadandhuduchu! Something went wrong.';
const NETWORK_ERROR = 'Server-ku connect aagala. Check your connection, thambi.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractDetail(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const { detail } = data;
  if (typeof detail === 'string' && detail.trim()) return detail;
  // FastAPI default 422 shape: detail = [{ loc, msg, type }]
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: unknown) => (isRecord(item) && typeof item.msg === 'string' ? item.msg : null))
      .filter((msg): msg is string => msg !== null);
    if (messages.length > 0) return messages.join(', ');
  }
  return null;
}

/** Human-readable message from any thrown value (extracts ApiError.detail when present). */
export function getErrorMessage(err: unknown, fallback: string = FALLBACK_ERROR): string {
  if (axios.isAxiosError(err)) {
    const detail = extractDetail(err.response?.data);
    if (detail) return detail;
    if (!err.response) return NETWORK_ERROR;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/** Machine-readable ApiError.code (e.g. "ATTEMPT_LIMIT_REACHED"), if any. */
export function getErrorCode(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const data: unknown = err.response?.data;
  return isRecord(data) && typeof data.code === 'string' ? data.code : undefined;
}

/** HTTP status of a failed request, if any. */
export function getErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export type ApiAxiosError = AxiosError<ApiError>;

export default api;
