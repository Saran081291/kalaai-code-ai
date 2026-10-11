import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AssignmentDetailPage from '@/pages/AssignmentDetailPage';
import { assignmentService } from '@/services/assignmentService';
import { courseService } from '@/services/courseService';

import { renderWithProviders } from '../test-utils';
import { apiError, makeAssignment, makeCourse } from './fixtures';

vi.mock('@/services/assignmentService', () => ({
  assignmentService: {
    listForCourse: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    publish: vi.fn(),
    updateRubric: vi.fn(),
  },
}));

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

function renderDetail(as: 'student' | 'instructor') {
  return renderWithProviders(
    <Routes>
      <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
    </Routes>,
    { route: '/assignments/11', as },
  );
}

describe('AssignmentDetailPage', () => {
  it('shows a student their attempts and an active submit CTA', async () => {
    vi.mocked(assignmentService.get).mockResolvedValue(makeAssignment({ myAttemptsCount: 1, maxAttempts: 3 }));
    vi.mocked(courseService.get).mockResolvedValue(makeCourse());
    renderDetail('student');

    expect(await screen.findByRole('heading', { name: 'FizzBuzz' })).toBeInTheDocument();
    expect(screen.getByTestId('attempts-used')).toHaveTextContent('1/3');
    expect(screen.getByRole('link', { name: /submit your code/i })).toHaveAttribute('href', '/assignments/11/submit');
    expect(screen.getByRole('link', { name: /my submissions/i })).toHaveAttribute('href', '/submissions');
    // Rubric + description rendered as text.
    expect(screen.getByText('Correctness')).toBeInTheDocument();
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
    expect(screen.getByText(/Use a loop/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /python basics/i })).toHaveAttribute('href', '/courses/7');
  });

  it('disables the submit CTA with an explanation at the attempt limit', async () => {
    vi.mocked(assignmentService.get).mockResolvedValue(makeAssignment({ myAttemptsCount: 3, maxAttempts: 3 }));
    vi.mocked(courseService.get).mockResolvedValue(makeCourse());
    renderDetail('student');

    expect(await screen.findByTestId('attempts-used')).toHaveTextContent('3/3');
    expect(screen.getByRole('button', { name: /submit your code/i })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /submit your code/i })).not.toBeInTheDocument();
    expect(screen.getByText(/used all 3 attempts/)).toBeInTheDocument();
  });

  it('disables the submit CTA when past due and late submissions are off', async () => {
    vi.mocked(assignmentService.get).mockResolvedValue(
      makeAssignment({ myAttemptsCount: 0, dueDate: '2020-01-01T00:00:00Z', allowLate: false }),
    );
    vi.mocked(courseService.get).mockResolvedValue(makeCourse());
    renderDetail('student');

    expect(await screen.findByRole('button', { name: /submit your code/i })).toBeDisabled();
    expect(screen.getByText(/late submissions are not allowed/)).toBeInTheDocument();
    expect(screen.getByText('Late', { selector: '.chakra-badge' })).toBeInTheDocument();
  });

  it('gives instructors edit / submissions actions instead of the submit CTA', async () => {
    vi.mocked(assignmentService.get).mockResolvedValue(makeAssignment({ isPublished: false }));
    vi.mocked(courseService.get).mockResolvedValue(makeCourse({ isInstructor: true }));
    renderDetail('instructor');

    expect(await screen.findByRole('link', { name: /^edit$/i })).toHaveAttribute('href', '/assignments/11/edit');
    expect(screen.getByRole('link', { name: /view submissions/i })).toHaveAttribute('href', '/assignments/11/submissions');
    expect(screen.getByRole('button', { name: /publish/i })).toBeEnabled();
    expect(screen.queryByText(/submit your code/i)).not.toBeInTheDocument();
  });

  it('shows a friendly 404 state', async () => {
    vi.mocked(assignmentService.get).mockRejectedValue(apiError(404, 'NOT_FOUND', 'Assignment not found'));
    renderDetail('student');

    expect(await screen.findByText("This assignment doesn't exist")).toBeInTheDocument();
  });
});
