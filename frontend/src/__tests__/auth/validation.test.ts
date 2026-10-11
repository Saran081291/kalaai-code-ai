import { describe, expect, it } from 'vitest';

import { getRedirectTarget, validateOptionalUrl } from '@/components/auth/validation';
import { ROUTES } from '@/lib/routes';

describe('getRedirectTarget', () => {
  const target = (from: unknown) => getRedirectTarget({ from });

  it('honours safe in-app paths', () => {
    expect(target('/dashboard?x=1')).toBe('/dashboard?x=1');
    expect(target('/submissions/12?tab=roast#top')).toBe('/submissions/12?tab=roast#top');
  });

  it.each(['/\\evil.com', '//evil.com', '/%2F%2Fevil', '/%5Cevil', 'javascript:alert(1)', 'https://evil.com', '/a:b', '/a//b'])(
    'rejects %s',
    (from) => {
      expect(target(from)).toBe(ROUTES.dashboard);
    },
  );

  it('falls back for missing state and auth pages', () => {
    expect(getRedirectTarget(null)).toBe(ROUTES.dashboard);
    expect(getRedirectTarget({})).toBe(ROUTES.dashboard);
    expect(target(42)).toBe(ROUTES.dashboard);
    expect(target(ROUTES.login)).toBe(ROUTES.dashboard);
    expect(target(ROUTES.register)).toBe(ROUTES.dashboard);
  });
});

describe('validateOptionalUrl (avatar)', () => {
  it('accepts empty and https URLs', () => {
    expect(validateOptionalUrl('')).toBeUndefined();
    expect(validateOptionalUrl('  ')).toBeUndefined();
    expect(validateOptionalUrl('https://lh3.googleusercontent.com/a/me.png')).toBeUndefined();
  });

  it('rejects http with a clear message', () => {
    expect(validateOptionalUrl('http://example.com/me.png')).toBe('URL must start with https://');
  });

  it('rejects other schemes and garbage', () => {
    expect(validateOptionalUrl('javascript:alert(1)')).toBe('URL must start with https://');
    expect(validateOptionalUrl('not a url')).toMatch(/valid https URL/);
  });
});
