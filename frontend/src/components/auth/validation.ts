import { ROUTES } from '@/lib/routes';

/** bcrypt only uses the first 72 bytes of a password, so the API rejects longer ones. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const FULL_NAME_MAX_LENGTH = 255;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Returns an error message, or undefined when valid. */
export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return undefined;
}

/** Login only checks presence — the server decides whether the password is right. */
export function validateLoginPassword(password: string): string | undefined {
  return password ? undefined : 'Password is required.';
}

export function validateNewPassword(password: string): string | undefined {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) {
    return `Password is too long (max ${PASSWORD_MAX_BYTES} bytes).`;
  }
  return undefined;
}

export function validateFullName(fullName: string, required: boolean): string | undefined {
  const trimmed = fullName.trim();
  if (!trimmed) return required ? 'Full name is required.' : undefined;
  if (trimmed.length > FULL_NAME_MAX_LENGTH) {
    return `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/** Optional https URL (avatars are loaded as images; http would be mixed content / blocked by CSP). */
export function validateOptionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') {
      return 'URL must start with https://';
    }
    return undefined;
  } catch {
    return 'Enter a valid https URL, e.g. https://example.com/me.png';
  }
}

export interface PasswordStrength {
  /** 0 (empty) … 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorScheme: 'red' | 'orange' | 'yellow' | 'green';
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', colorScheme: 'red' };
  let points = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (password.length < PASSWORD_MIN_LENGTH || points <= 1) {
    return { score: 1, label: 'Weak — romba easy-a guess pannidalaam', colorScheme: 'red' };
  }
  if (points === 2) return { score: 2, label: 'Okay — konjam strong aakalaam', colorScheme: 'orange' };
  if (points === 3) return { score: 3, label: 'Good', colorScheme: 'yellow' };
  return { score: 4, label: 'Semma strong 💪', colorScheme: 'green' };
}

const SAFE_REDIRECT_PATTERN = /^\/(?!\/)[A-Za-z0-9_\-./?=&#%]*$/;

/** Percent-encoded slash / backslash (%2F, %5C) can be decoded into `//` or a backslash downstream. */
const ENCODED_SLASH_PATTERN = /%(2f|5c)/i;

/** True for same-origin in-app paths only: no backslash, "//", ":" or other URL-ish characters. */
export function isSafeRedirectPath(value: string): boolean {
  return (
    SAFE_REDIRECT_PATTERN.test(value) &&
    !value.includes('\\') &&
    !value.includes('//') &&
    !value.includes(':') &&
    !ENCODED_SLASH_PATTERN.test(value)
  );
}

/**
 * Where to go after login: `location.state.from` if it is a safe in-app path, else /dashboard.
 * Only same-origin absolute paths are honoured (no `//evil.com` or `/\\evil.com` open redirects).
 */
export function getRedirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state;
    if (typeof from === 'string' && isSafeRedirectPath(from) && from !== ROUTES.login && from !== ROUTES.register) {
      return from;
    }
  }
  return ROUTES.dashboard;
}
