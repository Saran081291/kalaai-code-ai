import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStorage } from '@/lib/tokenStorage';
import {
  api,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  setAuthFailureHandler,
} from '@/services/api';

interface Call {
  url: string;
  auth: string | undefined;
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response = { data, status, statusText: '', headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(new AxiosError('fail', String(status), config, null, response));
}

describe('api client refresh-on-401', () => {
  const calls: Call[] = [];
  const originalAdapter = api.defaults.adapter;

  /** Fake server that only accepts the token "new". */
  const adapter: AxiosAdapter = (config) => {
    const auth = config.headers.get('Authorization');
    calls.push({ url: config.url ?? '', auth: typeof auth === 'string' ? auth : undefined });
    if (auth === 'Bearer new') return respond(config, 200, { ok: true });
    return respond(config, 401, { detail: 'expired' });
  };

  beforeEach(() => {
    calls.length = 0;
    api.defaults.adapter = adapter;
    tokenStorage.setTokens({ accessToken: 'old', refreshToken: 'r1' });
    // Already on /login so the failure handler does not trigger jsdom navigation.
    window.history.pushState({}, '', '/login');
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    setAuthFailureHandler(null);
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('refreshes once for concurrent 401s and replays every request', async () => {
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { accessToken: 'new', refreshToken: 'r2', tokenType: 'bearer' } });

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe('new');
    expect(tokenStorage.getRefreshToken()).toBe('r2');
    expect(calls.filter((c) => c.auth === 'Bearer new')).toHaveLength(3);
  });

  it('clears tokens, notifies the handler and rejects when refresh fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh denied'));
    const handler = vi.fn();
    setAuthFailureHandler(handler);

    await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 401 } });

    expect(tokenStorage.hasTokens()).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not attempt a refresh for login/register/refresh endpoints', async () => {
    const post = vi.spyOn(axios, 'post');
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(post).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('fails without a refresh token and does not loop', async () => {
    window.localStorage.removeItem('kalaai.refreshToken');
    const post = vi.spyOn(axios, 'post');
    await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 401 } });
    expect(post).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('does not retry a request twice when the replay is also 401', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'still-bad', refreshToken: 'r2', tokenType: 'bearer' },
    });
    await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toHaveLength(2);
  });
});

describe('error helpers', () => {
  function axiosErr(status: number, data: unknown): AxiosError {
    const config = { headers: {} } as InternalAxiosRequestConfig;
    return new AxiosError('x', String(status), config, null, {
      data,
      status,
      statusText: '',
      headers: {},
      config,
    });
  }

  it('extracts detail, validation messages, code and status', () => {
    expect(getErrorMessage(axiosErr(409, { detail: 'Attempt limit', code: 'ATTEMPT_LIMIT' }))).toBe(
      'Attempt limit',
    );
    expect(getErrorMessage(axiosErr(422, { detail: [{ msg: 'bad' }, { msg: 'worse' }] }))).toBe(
      'bad, worse',
    );
    expect(getErrorCode(axiosErr(409, { code: 'ATTEMPT_LIMIT' }))).toBe('ATTEMPT_LIMIT');
    expect(getErrorStatus(axiosErr(403, {}))).toBe(403);
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getErrorCode(new Error('x'))).toBeUndefined();
  });
});
