import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import type { UserRole } from '@/types';

import { makeAuthValue, makeUser, renderWithProviders } from '../test-utils';

function renderRoute(auth = makeAuthValue(null), roles?: UserRole[]) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<h1>Login page</h1>} />
      <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
      <Route element={<ProtectedRoute roles={roles} />}>
        <Route path="/secret" element={<h1>Secret page</h1>} />
      </Route>
    </Routes>,
    { route: '/secret', auth },
  );
}

describe('ProtectedRoute', () => {
  it('redirects signed-out users to /login', () => {
    renderRoute(makeAuthValue(null));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('renders nothing protected while auth is loading', () => {
    renderRoute(makeAuthValue(null, { isLoading: true }));
    expect(screen.queryByRole('heading', { name: 'Secret page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Login page' })).not.toBeInTheDocument();
  });

  it('redirects a student away from instructor-only routes', () => {
    renderRoute(makeAuthValue(makeUser({ role: 'student' })), ['instructor']);
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
  });

  it('allows the matching role', () => {
    renderRoute(makeAuthValue(makeUser({ role: 'instructor' })), ['instructor']);
    expect(screen.getByRole('heading', { name: 'Secret page' })).toBeInTheDocument();
  });

  it('lets admins through any role restriction', () => {
    renderRoute(makeAuthValue(makeUser({ role: 'admin' })), ['instructor']);
    expect(screen.getByRole('heading', { name: 'Secret page' })).toBeInTheDocument();
  });
});
