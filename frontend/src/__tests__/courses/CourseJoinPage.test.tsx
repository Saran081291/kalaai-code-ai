import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import CourseJoinPage from '@/pages/CourseJoinPage';
import { courseService } from '@/services/courseService';

import { renderWithProviders } from '../test-utils';
import { apiError, makeCourse } from './fixtures';

vi.mock('@/services/courseService', () => ({
  courseService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    join: vi.fn(),
    regenerateCode: vi.fn(),
    students: vi.fn(),
  },
}));

function renderJoin() {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/join" element={<CourseJoinPage />} />
      <Route path="/courses/:id" element={<h1>Course detail page</h1>} />
    </Routes>,
    { route: '/courses/join', as: 'student' },
  );
}

describe('CourseJoinPage', () => {
  it('uppercases the code, joins and navigates to the course', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(courseService.join).mockResolvedValue(makeCourse({ id: 42, name: 'Python Basics' }));
    renderJoin();

    const input = screen.getByRole('textbox', { name: /join code/i });
    await user.type(input, 'abcd-1234');
    expect(input).toHaveValue('ABCD1234');

    await user.click(screen.getByRole('button', { name: /join course/i }));

    expect(courseService.join).toHaveBeenCalledWith('ABCD1234');
    expect(await screen.findByRole('heading', { name: 'Course detail page' })).toBeInTheDocument();
  });

  it('validates the length before calling the API', async () => {
    const user = userEvent.setup({ delay: null });
    renderJoin();

    await user.type(screen.getByRole('textbox', { name: /join code/i }), 'abc');
    await user.click(screen.getByRole('button', { name: /join course/i }));

    expect(await screen.findByText(/exactly 8 letters or numbers/)).toBeInTheDocument();
    expect(courseService.join).not.toHaveBeenCalled();
  });

  it('shows a clear message for an invalid join code', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(courseService.join).mockRejectedValue(apiError(404, 'INVALID_JOIN_CODE', 'Not found'));
    renderJoin();

    await user.type(screen.getByRole('textbox', { name: /join code/i }), 'ZZZZ9999');
    await user.click(screen.getByRole('button', { name: /join course/i }));

    expect(await screen.findByText(/doesn't match any course/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course detail page' })).not.toBeInTheDocument();
  });

  it('shows a clear message when already enrolled', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(courseService.join).mockRejectedValue(apiError(409, 'ALREADY_ENROLLED', 'Conflict'));
    renderJoin();

    await user.type(screen.getByRole('textbox', { name: /join code/i }), 'ABCD1234');
    await user.click(screen.getByRole('button', { name: /join course/i }));

    expect(await screen.findByText(/already enrolled/)).toBeInTheDocument();
  });
});
