import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CoursesPage from '@/pages/CoursesPage';
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

describe('CoursesPage', () => {
  it('shows the student empty state with a Join course CTA', async () => {
    vi.mocked(courseService.list).mockResolvedValue([]);
    renderWithProviders(<CoursesPage />, { route: '/courses', as: 'student' });

    expect(await screen.findByText(/Innum course onnum illa! Join code vaangi join pannunga/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /join course/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /new course/i })).not.toBeInTheDocument();
  });

  it('shows the instructor empty state with a New course CTA', async () => {
    vi.mocked(courseService.list).mockResolvedValue([]);
    renderWithProviders(<CoursesPage />, { route: '/courses', as: 'instructor' });

    expect(await screen.findByText('First course create pannunga, annae!')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /new course/i })[0]).toHaveAttribute('href', '/courses/new');
    expect(screen.queryByRole('link', { name: /join course/i })).not.toBeInTheDocument();
  });

  it('renders a card per course with role and archived badges', async () => {
    vi.mocked(courseService.list).mockResolvedValue([
      makeCourse({ id: 1, name: 'Python Basics', isInstructor: true, studentCount: 12 }),
      makeCourse({ id: 2, name: 'Old JS', isInstructor: true, isArchived: true, studentCount: 1 }),
    ]);
    renderWithProviders(<CoursesPage />, { route: '/courses', as: 'instructor' });

    const link = await screen.findByRole('link', { name: 'Python Basics' });
    expect(link).toHaveAttribute('href', '/courses/1');
    expect(screen.getByRole('link', { name: 'Old JS' })).toHaveAttribute('href', '/courses/2');
    expect(screen.getAllByText('Teaching')).toHaveLength(2);
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('12 students')).toBeInTheDocument();
    expect(screen.getByText('1 student')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    vi.mocked(courseService.list).mockRejectedValue(apiError(500, 'SERVER_ERROR', 'Boom'));
    renderWithProviders(<CoursesPage />, { route: '/courses', as: 'student' });

    expect(await screen.findByText(/Couldn't load this course list/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
