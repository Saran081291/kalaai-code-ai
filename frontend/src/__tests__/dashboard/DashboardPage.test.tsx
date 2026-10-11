import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDueInfo } from '@/components/dashboard/dashboardUtils';
import { hasInProgressSubmissions } from '@/hooks/useDashboard';
import DashboardPage from '@/pages/DashboardPage';
import { dashboardService } from '@/services/dashboardService';

import { makeUser, renderWithProviders } from '../test-utils';
import { makeInstructorDashboard, makeStudentDashboard, makeSubmission } from './fixtures';

vi.mock('@/services/dashboardService', () => ({
  dashboardService: { get: vi.fn() },
}));

const getDashboard = vi.mocked(dashboardService.get);

beforeEach(() => {
  getDashboard.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage — common', () => {
  it('greets the user by first name and keeps a "Dashboard" heading', async () => {
    getDashboard.mockResolvedValue(makeStudentDashboard());
    renderWithProviders(<DashboardPage />, { as: makeUser({ fullName: 'Saran Kumar' }) });

    const heading = screen.getByRole('heading', { level: 1, name: /dashboard/i });
    expect(heading).toHaveTextContent('Vanakkam, Saran! 👋');
    expect(await screen.findByText('Linked List Lab')).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    getDashboard.mockRejectedValueOnce(new Error('Server sleeping')).mockResolvedValueOnce(makeStudentDashboard());
    renderWithProviders(<DashboardPage />, { as: 'student' });

    expect(await screen.findByText('Server sleeping')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Linked List Lab')).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});

describe('DashboardPage — student', () => {
  it('renders stats, upcoming assignments, recent results and ranks', async () => {
    getDashboard.mockResolvedValue(makeStudentDashboard());
    renderWithProviders(<DashboardPage />, { as: 'student' });

    // Upcoming
    const upcoming = await screen.findAllByTestId('upcoming-item');
    expect(upcoming).toHaveLength(3);
    const first = upcoming[0]!;
    expect(within(first).getByRole('link', { name: 'Linked List Lab' })).toHaveAttribute('href', '/assignments/11');
    expect(within(first).getByRole('link', { name: 'Submit Linked List Lab' })).toHaveAttribute(
      'href',
      '/assignments/11/submit',
    );
    expect(within(first).getByText('1/3')).toBeInTheDocument();
    expect(within(first).getByText(/^Due in \d+ hours?$/)).toHaveAttribute('data-urgency', 'urgent');
    expect(within(upcoming[1]!).getByText(/^Due in 2 days$/)).toHaveAttribute('data-urgency', 'soon');
    // Exhausted attempts → no submit link.
    expect(within(upcoming[2]!).getByRole('button', { name: /no attempts left/i })).toBeDisabled();

    // Recent results
    const results = screen.getAllByTestId('recent-result');
    expect(results).toHaveLength(2);
    expect(within(results[0]!).getByRole('link', { name: 'FizzBuzz Deluxe' })).toHaveAttribute('href', '/submissions/101');
    expect(within(results[0]!).getByLabelText('Score 82 out of 100')).toBeInTheDocument();
    expect(within(results[1]!).getByText('Reviewing')).toBeInTheDocument();
    expect(within(results[1]!).getByLabelText('Spice level: Madurai Mass')).toBeInTheDocument();

    // Ranks + stats
    const rankCards = screen.getAllByTestId('rank-card');
    expect(rankCards).toHaveLength(2);
    expect(within(rankCards[0]!).getByRole('link', { name: /python basics leaderboard/i })).toHaveAttribute(
      'href',
      '/courses/7/leaderboard',
    );
    expect(within(rankCards[0]!).getByText('#3')).toBeInTheDocument();
    expect(within(rankCards[0]!).getByText('of 25')).toBeInTheDocument();
    expect(screen.getByText('Courses enrolled')).toBeInTheDocument();
    expect(screen.getByText('Best rank')).toBeInTheDocument();
  });

  it('asks the student to join a course when not enrolled anywhere', async () => {
    getDashboard.mockResolvedValue(makeStudentDashboard({ ranks: [], upcomingAssignments: [], recentResults: [] }));
    renderWithProviders(<DashboardPage />, { as: 'student' });

    expect(await screen.findByText('Mudhalla oru course join pannunga, thambi!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join a course' })).toHaveAttribute('href', '/courses/join');
  });

  it('celebrates when nothing is upcoming', async () => {
    getDashboard.mockResolvedValue(makeStudentDashboard({ upcomingAssignments: [] }));
    renderWithProviders(<DashboardPage />, { as: 'student' });

    expect(await screen.findByText('Ellam submit panniyaachu! Semma 🎉')).toBeInTheDocument();
    expect(screen.queryAllByTestId('upcoming-item')).toHaveLength(0);
  });
});

describe('DashboardPage — instructor', () => {
  it('renders stats, the failed reviews alert, recent submissions and course stats', async () => {
    getDashboard.mockResolvedValue(makeInstructorDashboard());
    renderWithProviders(<DashboardPage />, { as: 'instructor' });

    const alert = await screen.findByTestId('failed-reviews-alert');
    expect(within(alert).getByText(/1 review failed/i)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: /open and retry graph gauntlet by pandi/i })).toHaveAttribute(
      'href',
      '/submissions/301',
    );

    // Stat totals: 2 courses, 37 students, 80 submissions, 3 in progress.
    expect(screen.getByText('Courses').closest('dl')).toHaveTextContent('2');
    expect(screen.getByText('Total students').closest('dl')).toHaveTextContent('37');
    expect(screen.getByText('Total submissions').closest('dl')).toHaveTextContent('80');
    expect(screen.getByText('In progress').closest('dl')).toHaveTextContent('3');

    const rows = screen.getAllByTestId('recent-submission-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Meena')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'FizzBuzz Deluxe' })).toHaveAttribute('href', '/submissions/201');
    expect(within(rows[0]!).getByText('82/100')).toBeInTheDocument();

    const courses = screen.getAllByTestId('course-stat');
    expect(courses).toHaveLength(2);
    expect(within(courses[0]!).getByRole('link', { name: 'Python Basics' })).toHaveAttribute('href', '/courses/7');
  });

  it('hides the failed alert when nothing failed', async () => {
    getDashboard.mockResolvedValue(makeInstructorDashboard({ failedSubmissions: [] }));
    renderWithProviders(<DashboardPage />, { as: 'instructor' });

    await screen.findAllByTestId('recent-submission-row');
    expect(screen.queryByTestId('failed-reviews-alert')).not.toBeInTheDocument();
  });

  it('shows the create-course empty state for a new instructor', async () => {
    getDashboard.mockResolvedValue(
      makeInstructorDashboard({ courseStats: [], recentSubmissions: [], failedSubmissions: [] }),
    );
    renderWithProviders(<DashboardPage />, { as: 'instructor' });

    expect(await screen.findByText('First course create pannunga, annae!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a course' })).toHaveAttribute('href', '/courses/new');
  });
});

describe('dashboard helpers', () => {
  it('detects in-progress submissions for polling', () => {
    expect(hasInProgressSubmissions(undefined)).toBe(false);
    expect(hasInProgressSubmissions(makeStudentDashboard())).toBe(true);
    expect(
      hasInProgressSubmissions(makeStudentDashboard({ recentResults: [makeSubmission({ status: 'completed' })] })),
    ).toBe(false);
    expect(hasInProgressSubmissions(makeInstructorDashboard())).toBe(true);
  });

  it('colors due dates by urgency', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(getDueInfo(null, now).urgency).toBe('none');
    expect(getDueInfo('2026-10-10T10:00:00Z', now).colorScheme).toBe('red');
    expect(getDueInfo('2026-10-10T20:00:00Z', now)).toMatchObject({ urgency: 'urgent', colorScheme: 'red' });
    expect(getDueInfo('2026-10-12T12:00:00Z', now)).toMatchObject({ urgency: 'soon', colorScheme: 'orange' });
    expect(getDueInfo('2026-10-20T12:00:00Z', now)).toMatchObject({ urgency: 'later', colorScheme: 'green' });
  });

  it('polls the service only once per mount when nothing is in progress', async () => {
    getDashboard.mockResolvedValue(makeInstructorDashboard({ recentSubmissions: [], failedSubmissions: [] }));
    renderWithProviders(<DashboardPage />, { as: 'instructor' });
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1));
  });
});
