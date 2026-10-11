import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RoastWallPage from '@/pages/RoastWallPage';
import { courseService } from '@/services/courseService';
import { roastService } from '@/services/roastService';
import type { ReactionSummary } from '@/types';

import { renderWithProviders } from '../test-utils';
import { makeApiError, makeCourse, makePage, makeSummary, makeWallItem } from './fixtures';

vi.mock('@/services/roastService');
vi.mock('@/services/courseService');

const wall = vi.mocked(roastService.wall);
const addReaction = vi.mocked(roastService.addReaction);
const removeReaction = vi.mocked(roastService.removeReaction);

function renderWall(route = '/courses/5/roast-wall') {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:id/roast-wall" element={<RoastWallPage />} />
    </Routes>,
    { route, as: 'student' },
  );
}

beforeEach(() => {
  vi.mocked(courseService.get).mockResolvedValue(makeCourse());
  wall.mockResolvedValue(
    makePage([
      makeWallItem(),
      makeWallItem({
        id: 2,
        punchline: 'Semicolon-a vida un confidence perusu!',
        studentName: 'Meena S',
        myReactions: ['laugh'],
        effectiveScore: null,
      }),
    ]),
  );
});

describe('RoastWallPage', () => {
  it('renders roast cards with reaction counts and course name', async () => {
    renderWall();

    expect(await screen.findByText(/Meenakshi Amman-e shock/)).toBeInTheDocument();
    expect(screen.getByText(/Semicolon-a vida/)).toBeInTheDocument();
    expect(screen.getAllByTestId('roast-card')).toHaveLength(2);
    expect(await screen.findByText(/Python Basics/)).toBeInTheDocument();
    expect(screen.getByText('Karthik Raja')).toBeInTheDocument();
    expect(screen.getByLabelText('Score 42 out of 50')).toBeInTheDocument();

    const fireButtons = screen.getAllByRole('button', { name: 'React fire (3)' });
    expect(fireButtons).toHaveLength(2);
    expect(fireButtons[0]).toHaveAttribute('aria-pressed', 'false');
    // Second card: user already laughed.
    expect(screen.getAllByRole('button', { name: 'React laugh (2)' })[1]).toHaveAttribute('aria-pressed', 'true');
    expect(wall).toHaveBeenCalledWith(5, { sort: 'recent', page: 1, pageSize: 12 });
  });

  it('adds a reaction with an optimistic count increment', async () => {
    // Never resolves → we observe the purely optimistic state.
    addReaction.mockReturnValue(new Promise<ReactionSummary>(() => undefined));
    const user = userEvent.setup();
    renderWall();

    const [fire] = await screen.findAllByRole('button', { name: 'React fire (3)' });
    await user.click(fire!);

    expect(addReaction).toHaveBeenCalledWith(1, 'fire');
    const updated = await screen.findByRole('button', { name: 'React fire (4)' });
    expect(updated).toHaveAttribute('aria-pressed', 'true');
    expect(removeReaction).not.toHaveBeenCalled();
  });

  it('removes an existing reaction', async () => {
    removeReaction.mockResolvedValue(
      makeSummary({ roastId: 2, reactionCounts: { fire: 3, laugh: 1, skull: 0, clap: 1 }, myReactions: [] }),
    );
    const user = userEvent.setup();
    renderWall();

    const laughButtons = await screen.findAllByRole('button', { name: 'React laugh (2)' });
    await user.click(laughButtons[1]!);

    expect(removeReaction).toHaveBeenCalledWith(2, 'laugh');
    expect(addReaction).not.toHaveBeenCalled();
    const updated = await screen.findByRole('button', { name: 'React laugh (1)' });
    expect(updated).toHaveAttribute('aria-pressed', 'false');
  });

  it('rolls back the optimistic update when the request fails', async () => {
    addReaction.mockRejectedValue(makeApiError(500, 'SERVER_ERROR', 'Boom'));
    const user = userEvent.setup();
    renderWall();

    const [skull] = await screen.findAllByRole('button', { name: 'React skull (0)' });
    await user.click(skull!);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'React skull (0)' })).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'React skull (1)' })).not.toBeInTheDocument();
  });

  it('refetches with sort=top when the sort toggle changes', async () => {
    const user = userEvent.setup();
    renderWall();

    await screen.findAllByTestId('roast-card');
    const recent = screen.getByRole('button', { name: 'Recent' });
    expect(recent).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /top/i }));

    await waitFor(() => expect(wall).toHaveBeenCalledWith(5, { sort: 'top', page: 1, pageSize: 12 }));
    expect(screen.getByRole('button', { name: /top/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads the next page with the Load more button', async () => {
    wall.mockImplementation((_courseId, params = {}) =>
      Promise.resolve(
        params.page === 2
          ? makePage([makeWallItem({ id: 3, punchline: 'Page two roast varudhu!' })], { page: 2, total: 13 })
          : makePage([makeWallItem()], { page: 1, total: 13 }),
      ),
    );
    const user = userEvent.setup();
    renderWall();

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText(/Page two roast varudhu/)).toBeInTheDocument();
    expect(wall).toHaveBeenCalledWith(5, { sort: 'recent', page: 2, pageSize: 12 });
  });

  it('shows the empty state when nobody shared a roast', async () => {
    wall.mockResolvedValue(makePage([]));
    renderWall();

    expect(await screen.findByText(/Roast Wall kaali-ya irukku!/)).toBeInTheDocument();
  });

  it('shows a friendly state for non-members (403)', async () => {
    wall.mockRejectedValue(makeApiError(403, 'NOT_COURSE_MEMBER', 'Not a member'));
    vi.mocked(courseService.get).mockRejectedValue(makeApiError(403, 'NOT_COURSE_MEMBER', 'Not a member'));
    renderWall();

    expect(await screen.findByText('Indha course-la neenga member illa!')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sort roasts' })).not.toBeInTheDocument();
  });
});
