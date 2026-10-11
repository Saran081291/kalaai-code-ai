import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LeaderboardPage from '@/pages/LeaderboardPage';
import { courseService } from '@/services/courseService';
import { roastService } from '@/services/roastService';

import { makeUser, renderWithProviders } from '../test-utils';
import { makeCourse, makeEntry } from './fixtures';

vi.mock('@/services/roastService');
vi.mock('@/services/courseService');

const leaderboard = vi.mocked(roastService.leaderboard);
const me = makeUser({ id: 105, fullName: 'Thambi Test' });

function renderLeaderboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:id/leaderboard" element={<LeaderboardPage />} />
    </Routes>,
    { route: '/courses/5/leaderboard', as: me },
  );
}

beforeEach(() => {
  vi.mocked(courseService.get).mockResolvedValue(makeCourse());
  leaderboard.mockResolvedValue([
    makeEntry({ rank: 1, studentId: 101, studentName: 'Anitha', totalScore: 140 }),
    makeEntry({ rank: 2, studentId: 102, studentName: 'Bala', totalScore: 120 }),
    makeEntry({ rank: 2, studentId: 103, studentName: 'Chitra', totalScore: 120 }),
    makeEntry({ rank: 4, studentId: 104, studentName: 'Dinesh', totalScore: 90 }),
    makeEntry({ rank: 5, studentId: 105, studentName: 'Thambi Test', totalScore: 70, assignmentsCompleted: 2 }),
  ]);
});

describe('LeaderboardPage', () => {
  it('renders the top 3 on the podium and the rest in the table', async () => {
    renderLeaderboard();

    const podium = await screen.findByRole('list', { name: 'Top 3' });
    const podiumEntries = within(podium).getAllByTestId('podium-entry');
    expect(podiumEntries).toHaveLength(3);
    expect(within(podium).getByText('Anitha')).toBeInTheDocument();
    expect(within(podium).getByText('140 pts')).toBeInTheDocument();
    expect(within(podium).getByText('🥇')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Dinesh')).toBeInTheDocument();
    expect(within(table).queryByText('Anitha')).not.toBeInTheDocument();
    expect(await screen.findByText(/Python Basics/)).toBeInTheDocument();
  });

  it('gives tied students the same rank and medal', async () => {
    renderLeaderboard();

    const podium = await screen.findByRole('list', { name: 'Top 3' });
    expect(within(podium).getAllByText('🥈')).toHaveLength(2);
    expect(within(podium).getAllByText('Tie')).toHaveLength(2);
    expect(within(podium).getAllByText('Rank 2')).toHaveLength(2);
    expect(within(podium).queryByText('🥉')).not.toBeInTheDocument();
  });

  it("highlights the current user's row", async () => {
    renderLeaderboard();

    const badge = await screen.findByText('Neenga dhaan! 👋');
    const row = badge.closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(within(row!).getByText('Thambi Test')).toBeInTheDocument();
    expect(within(row!).getByText('#5')).toBeInTheDocument();
  });

  it('shows the empty state when nobody has scores yet', async () => {
    leaderboard.mockResolvedValue([]);
    renderLeaderboard();

    expect(await screen.findByText('Innum score-e illa, first submit pannunga!')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
