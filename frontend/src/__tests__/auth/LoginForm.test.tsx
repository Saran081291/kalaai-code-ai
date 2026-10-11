import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from '@/pages/LoginPage';

import { makeAuthValue, makeUser, renderWithProviders } from '../test-utils';
import { apiError, fill, FIND_TIMEOUT, TEST_TIMEOUT } from './helpers';

function renderLogin(route = '/login', auth = makeAuthValue(null)) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
    </Routes>,
    { route, auth },
  );
  return auth;
}

describe('LoginPage / LoginForm', { timeout: TEST_TIMEOUT }, () => {
  it('submits credentials, calls login and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    const auth = renderLogin();

    expect(screen.getByRole('heading', { name: /vaanga, login/i })).toBeInTheDocument();
    await fill(user, screen.getByLabelText(/^email/i), '  thambi@example.com ');
    await fill(user, screen.getByLabelText(/^password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith({ email: 'thambi@example.com', password: 'secret123' }),
      FIND_TIMEOUT,
    );
    expect(await screen.findByRole('heading', { name: 'Dashboard page' }, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('validates fields before calling the API', async () => {
    const user = userEvent.setup();
    const auth = renderLogin();

    await fill(user, screen.getByLabelText(/^email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByText('Enter a valid email address.', undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('shows a friendly message for INVALID_CREDENTIALS', async () => {
    const user = userEvent.setup();
    const auth = makeAuthValue(null, {
      login: vi.fn(() => Promise.reject(apiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'))),
    });
    renderLogin('/login', auth);

    await fill(user, screen.getByLabelText(/^email/i), 'thambi@example.com');
    await fill(user, screen.getByLabelText(/^password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByText(/email or password thappu/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard page' })).not.toBeInTheDocument();
  });

  it('shows the API detail for other errors', async () => {
    const user = userEvent.setup();
    const auth = makeAuthValue(null, {
      login: vi.fn(() => Promise.reject(apiError(403, 'Account disabled', 'ACCOUNT_DISABLED'))),
    });
    renderLogin('/login', auth);

    await fill(user, screen.getByLabelText(/^email/i), 'thambi@example.com');
    await fill(user, screen.getByLabelText(/^password/i), 'whatever1');
    await user.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByText('Account disabled', undefined, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();

    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('shows the OAuth error from the query string', () => {
    renderLogin('/login?error=oauth_failed');
    expect(screen.getByText(/google login failed/i)).toBeInTheDocument();
  });

  it('redirects signed-in users to the dashboard', async () => {
    renderLogin('/login', makeAuthValue(makeUser()));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' }, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('offers Google login and a link to register', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });
});
