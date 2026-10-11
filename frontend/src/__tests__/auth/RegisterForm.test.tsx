import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import RegisterPage from '@/pages/RegisterPage';

import { makeAuthValue, renderWithProviders } from '../test-utils';
import { apiError, fill, FIND_TIMEOUT, TEST_TIMEOUT } from './helpers';

function renderRegister(auth = makeAuthValue(null), route = '/register') {
  renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
    </Routes>,
    { route, auth },
  );
  return auth;
}

async function fillBasics(user: UserEvent, confirm = 'supersecret1') {
  await fill(user, screen.getByLabelText(/^full name/i), 'Meena Kumari');
  await fill(user, screen.getByLabelText(/^email/i), 'meena@example.com');
  await fill(user, screen.getByLabelText(/^password/i), 'supersecret1');
  await fill(user, screen.getByLabelText(/^confirm password/i), confirm);
}

const submit = (user: UserEvent) => user.click(screen.getByRole('button', { name: /create account/i }));

describe('RegisterPage / RegisterForm', { timeout: TEST_TIMEOUT }, () => {
  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    const auth = renderRegister();

    await fillBasics(user, 'different123');
    await user.click(screen.getByRole('radio', { name: 'Student' }));
    await submit(user);

    expect(await screen.findByText('Passwords do not match.', undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('requires a role', async () => {
    const user = userEvent.setup();
    const auth = renderRegister();

    await fillBasics(user);
    await submit(user);

    expect(await screen.findByText(/please choose a role/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('rejects short passwords', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fill(user, screen.getByLabelText(/^password/i), 'short');
    await submit(user);

    expect(await screen.findByText(/at least 8 characters\.$/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('calls register with the selected role and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    const auth = renderRegister();

    await fillBasics(user);
    const instructor = screen.getByRole('radio', { name: 'Instructor' });
    await user.click(instructor);
    expect(instructor).toBeChecked();
    await submit(user);

    await waitFor(() =>
      expect(auth.register).toHaveBeenCalledWith({
        fullName: 'Meena Kumari',
        email: 'meena@example.com',
        password: 'supersecret1',
        role: 'instructor',
      }),
      FIND_TIMEOUT,
    );
    expect(await screen.findByRole('heading', { name: 'Dashboard page' }, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('handles EMAIL_TAKEN', async () => {
    const user = userEvent.setup();
    const auth = makeAuthValue(null, {
      register: vi.fn(() => Promise.reject(apiError(409, 'Email already registered', 'EMAIL_TAKEN'))),
    });
    renderRegister(auth);

    await fillBasics(user);
    await user.click(screen.getByRole('radio', { name: 'Student' }));
    await submit(user);

    expect(await screen.findAllByText('An account with this email already exists.', undefined, FIND_TIMEOUT)).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /login pannunga/i })).toHaveAttribute('href', '/login');
  });

  it('preselects the role from ?role=', () => {
    renderRegister(makeAuthValue(null), '/register?role=instructor');
    expect(screen.getByRole('radio', { name: 'Instructor' })).toBeChecked();
  });
});
