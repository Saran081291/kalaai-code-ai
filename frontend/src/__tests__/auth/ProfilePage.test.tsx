import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ProfilePage from '@/pages/ProfilePage';

import { makeAuthValue, makeUser, renderWithProviders } from '../test-utils';
import { apiError, fill, FIND_TIMEOUT, TEST_TIMEOUT } from './helpers';

describe('ProfilePage', { timeout: TEST_TIMEOUT }, () => {
  it('shows account details', () => {
    const user = makeUser({ role: 'instructor', oauthProvider: 'google', email: 'anna@example.com' });
    renderWithProviders(<ProfilePage />, { auth: makeAuthValue(user) });

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getAllByText('anna@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Instructor')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText(/october 2026/i)).toBeInTheDocument();
  });

  it('validates the avatar URL', async () => {
    const ui = userEvent.setup();
    const auth = makeAuthValue(makeUser());
    renderWithProviders(<ProfilePage />, { auth });

    await fill(ui, screen.getByLabelText(/^avatar url/i), 'not a url');
    await ui.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/enter a valid https url/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('saves name, avatar and default spice level', async () => {
    const ui = userEvent.setup();
    const auth = makeAuthValue(makeUser());
    renderWithProviders(<ProfilePage />, { auth });

    const name = screen.getByLabelText(/^full name/i);
    await ui.clear(name);
    await fill(ui, name, 'Thambi Updated');
    await fill(ui, screen.getByLabelText(/^avatar url/i), 'https://example.com/me.png');
    await ui.click(screen.getByRole('radio', { name: 'Madurai Mass' }));
    await ui.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(auth.updateProfile).toHaveBeenCalledWith({
        fullName: 'Thambi Updated',
        avatarUrl: 'https://example.com/me.png',
        defaultSpiceLevel: 'mass',
      }),
      FIND_TIMEOUT,
    );
    expect(await screen.findByText(/semma! profile update aachu/i, undefined, FIND_TIMEOUT)).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    const ui = userEvent.setup();
    const auth = makeAuthValue(makeUser(), {
      updateProfile: vi.fn(() => Promise.reject(apiError(422, 'Avatar URL too long', 'VALIDATION_ERROR'))),
    });
    renderWithProviders(<ProfilePage />, { auth });

    await ui.click(screen.getByRole('button', { name: /save changes/i }));
    expect((await screen.findAllByText('Avatar URL too long', undefined, FIND_TIMEOUT)).length).toBeGreaterThan(0);
  });
});
