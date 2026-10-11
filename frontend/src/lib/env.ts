const DEFAULT_API_URL = 'http://localhost:8000';

/** Backend origin without trailing slash. */
export const API_URL: string = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

/** Versioned API base used by the axios client. */
export const API_BASE_URL = `${API_URL}/api/v1`;

/** Full-page URL that starts the Google OAuth redirect flow. */
export const GOOGLE_LOGIN_URL = `${API_BASE_URL}/auth/google/login`;
