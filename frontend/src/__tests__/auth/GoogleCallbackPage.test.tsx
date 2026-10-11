import { screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GoogleCallbackPage from '@/pages/GoogleCallbackPage';

import { makeAuthValue, renderWithProviders } from '../test-utils';
import { FIND_TIMEOUT, TEST_TIMEOUT } from './helpers';

function renderCallback(auth = makeAuthValue(null)) {
  renderWithProviders(
    <StrictMode>
      <Routes>
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
      </Routes>
    </StrictMode>,
    { route: '/auth/google/callback', auth },
  );
  return auth;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('GoogleCallbackPage', { timeout: TEST_TIMEOUT }, () => {
  it('logs in with the hash tokens once, clears the hash and goes to the dashboard', async () => {
    window.history.replaceState(null, '', '/auth/google/callback#accessToken=acc-123&refreshToken=ref-456');
    const auth = renderCallback();

    expect(await screen.findByRole('heading', { name: 'Dashboard page' }, FIND_TIMEOUT)).toBeInTheDocument();
    expect(auth.loginWithTokens).toHaveBeenCalledTimes(1);
    expect(auth.loginWithTokens).toHaveBeenCalledWith({ accessToken: 'acc-123', refreshToken: 'ref-456' });
    expect(window.location.hash).toBe('');
  });

  it('shows an error with a link back to login when tokens are missing', async () => {
    window.history.replaceState(null, '', '/auth/google/callback');
    const auth = renderCallback();

    expect(await screen.findByText(/did not return a session/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login');
    expect(auth.loginWithTokens).not.toHaveBeenCalled();
  });

  it('shows an error when loading the user fails', async () => {
    window.history.replaceState(null, '', '/auth/google/callback#accessToken=a&refreshToken=b');
    const auth = makeAuthValue(null, { loginWithTokens: vi.fn(() => Promise.reject(new Error('Token expired'))) });
    renderCallback(auth);

    await waitFor(() => expect(screen.getByText('Token expired')).toBeInTheDocument(), FIND_TIMEOUT);
    expect(screen.queryByRole('heading', { name: 'Dashboard page' })).not.toBeInTheDocument();
  });
});
