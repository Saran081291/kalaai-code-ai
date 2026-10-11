import { afterEach, describe, expect, it, vi } from 'vitest';

import { tokenStorage } from '@/lib/tokenStorage';

describe('tokenStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('stores, reads and clears the token pair', () => {
    expect(tokenStorage.hasTokens()).toBe(false);
    tokenStorage.setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(tokenStorage.getAccessToken()).toBe('a');
    expect(tokenStorage.getRefreshToken()).toBe('r');
    expect(tokenStorage.hasTokens()).toBe(true);
    tokenStorage.clearTokens();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.hasTokens()).toBe(false);
  });

  it('tolerates a throwing localStorage (private mode / blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => tokenStorage.setTokens({ accessToken: 'a', refreshToken: 'r' })).not.toThrow();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.hasTokens()).toBe(false);
    expect(() => tokenStorage.clearTokens()).not.toThrow();
  });
});
