import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@/App';
import { getNavItems } from '@/components/layout/navConfig';

import { renderWithProviders } from './test-utils';

// App pages fetch on mount; keep this routing test off the network.
vi.mock('@/services/courseService', () => ({
  courseService: { list: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('@/services/dashboardService', () => ({
  dashboardService: {
    get: vi.fn(() =>
      Promise.resolve({
        role: 'student',
        upcomingAssignments: [],
        recentResults: [],
        ranks: [],
      }),
    ),
  },
}));

describe('navConfig', () => {
  it('gives students My Submissions but not instructors', () => {
    expect(getNavItems('student').map((i) => i.label)).toEqual(['Dashboard', 'Courses', 'My Submissions', 'Settings']);
    expect(getNavItems('instructor').map((i) => i.label)).toEqual(['Dashboard', 'Courses', 'Settings']);
  });
});

describe('AppRoutes', () => {
  it('renders the app shell and a lazy page', async () => {
    renderWithProviders(<AppRoutes />, { route: '/courses', as: 'student' });
    expect(await screen.findByRole('heading', { name: 'Courses' })).toBeInTheDocument();
    // jsdom matches the base breakpoint, so the desktop sidebar is display:none → query hidden elements too.
    expect(screen.getAllByRole('link', { name: /my submissions|dashboard/i, hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });

  it('redirects signed-out users from app routes to login', async () => {
    renderWithProviders(<AppRoutes />, { route: '/courses' });
    expect(await screen.findByRole('heading', { name: /login|welcome|vaanga/i })).toBeInTheDocument();
  });

  it('redirects students away from instructor-only routes', async () => {
    renderWithProviders(<AppRoutes />, { route: '/courses/new', as: 'student' });
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', async () => {
    renderWithProviders(<AppRoutes />, { route: '/nope' });
    expect(await screen.findByRole('heading', { name: '404' })).toBeInTheDocument();
  });
});
