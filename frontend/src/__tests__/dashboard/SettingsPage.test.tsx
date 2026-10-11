import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/pages/SettingsPage';
import type { UpdateProfileRequest, User } from '@/types';

import { makeAuthValue, makeUser, renderWithProviders } from '../test-utils';

describe('SettingsPage', () => {
  it('renders all sections with the current spice level selected', () => {
    const user = makeUser({ defaultSpiceLevel: 'medium' });
    renderWithProviders(<SettingsPage />, { auth: makeAuthValue(user) });

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roast preferences' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /medium/i })).toBeChecked();
    expect(screen.getByRole('link', { name: /edit profile/i })).toHaveAttribute('href', '/profile');
  });

  it('saves the default spice level via updateProfile and toasts', async () => {
    const user = makeUser({ defaultSpiceLevel: 'medium' });
    const updateProfile = vi.fn((body: UpdateProfileRequest): Promise<User> =>
      Promise.resolve({ ...user, defaultSpiceLevel: body.defaultSpiceLevel ?? user.defaultSpiceLevel }),
    );
    renderWithProviders(<SettingsPage />, { auth: makeAuthValue(user, { updateProfile }) });

    await userEvent.click(screen.getByRole('radio', { name: /madurai mass/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ defaultSpiceLevel: 'mass' }));
    expect(await screen.findByText('Spice level save aachu 🌶️')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /madurai mass/i })).toBeChecked();
  });

  it('reverts the selection and shows an error when saving fails', async () => {
    const user = makeUser({ defaultSpiceLevel: 'mild' });
    const updateProfile = vi.fn((): Promise<User> => Promise.reject(new Error('Network pochu')));
    renderWithProviders(<SettingsPage />, { auth: makeAuthValue(user, { updateProfile }) });

    await userEvent.click(screen.getByRole('radio', { name: /madurai mass/i }));

    expect(await screen.findByText('Could not save spice level')).toBeInTheDocument();
    expect(screen.getByText('Network pochu')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('radio', { name: /mild/i })).toBeChecked());
  });

  it('logs out and navigates to login', async () => {
    const auth = makeAuthValue(makeUser());
    renderWithProviders(
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>,
      { auth, route: '/settings' },
    );

    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
