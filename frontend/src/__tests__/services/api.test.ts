import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStorage } from '@/lib/tokenStorage';
import { api, setAuthFailureHandler } from '@/services/api';
import type { TokenPair } from '@/types';

const OLD_ACCESS = 'old-access';
const NEW_ACCESS = 'new-access';

function makeResponse(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config };
}

/** Adapter: 401 unless the request carries the token the "server" currently accepts. */
function makeAdapter(validToken: () => string): AxiosAdapter {
  return (config) => {
    const ok = config.headers.get('Authorization') === `Bearer ${validToken()}`;
    if (ok) return Promise.resolve(makeResponse(config, 200, { ok: true }));
    return Promise.reject(
      new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, makeResponse(config, 401, {})),
    );
  };
}

function pair(access: string, refresh: string): TokenPair {
  return { accessToken: access, refreshToken: refresh, tokenType: 'bearer' } as TokenPair;
}

describe('api refresh interceptor', () => {
  const originalAdapter = api.defaults.adapter;
  const originalLocation = window.location;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    tokenStorage.setTokens({ accessToken: OLD_ACCESS, refreshToken: 'refresh-1' });
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard', assign },
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    Reflect.deleteProperty(navigator, 'locks');
  });

  function installLocks(beforeRun?: () => void): ReturnType<typeof vi.fn> {
    // Serialises callbacks like the real Web Locks API (exclusive lock).
    let tail: Promise<unknown> = Promise.resolve();
    const request = vi.fn(<T>(_name: string, cb: () => Promise<T>): Promise<T> => {
      const run = tail.then(() => {
        beforeRun?.();
        return cb();
      });
      tail = run.catch(() => undefined);
      return run;
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    return request;
  }

  it('issues a single refresh for concurrent 401s and retries each request', async () => {
    const locks = installLocks();
    // Server only accepts the rotated token.
    api.defaults.adapter = makeAdapter(() => NEW_ACCESS);
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: pair(NEW_ACCESS, 'refresh-2') });

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(locks).toHaveBeenCalledWith('kalaai-refresh', expect.any(Function));
    expect(tokenStorage.getAccessToken()).toBe(NEW_ACCESS);
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2');
  });

  it('skips the refresh when another tab rotated the tokens while waiting for the lock', async () => {
    const locks = installLocks(() => {
      // Another tab held the lock, refreshed, and stored the rotated pair.
      tokenStorage.setTokens({ accessToken: NEW_ACCESS, refreshToken: 'refresh-2' });
    });
    api.defaults.adapter = makeAdapter(() => NEW_ACCESS);
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: pair('unused', 'unused') });

    const res = await api.get('/a');

    expect(res.status).toBe(200);
    expect(locks).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2');
  });

  it('still refreshes when navigator.locks is unavailable (in-tab fallback)', async () => {
    api.defaults.adapter = makeAdapter(() => NEW_ACCESS);
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: pair(NEW_ACCESS, 'refresh-2') });

    const results = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('clears tokens, notifies the auth handler and redirects when refresh fails', async () => {
    installLocks();
    api.defaults.adapter = makeAdapter(() => NEW_ACCESS);
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));
    const handler = vi.fn();
    const unsubscribe = setAuthFailureHandler(handler);

    await expect(api.get('/a')).rejects.toBeDefined();

    unsubscribe();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login');
  });
});
