import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AssignmentSubmissionsPage from '@/pages/AssignmentSubmissionsPage';
import MySubmissionsPage from '@/pages/MySubmissionsPage';
import { assignmentService } from '@/services/assignmentService';
import { submissionService } from '@/services/submissionService';
import type { Page, Submission } from '@/types';

import { renderWithProviders } from '../test-utils';

vi.mock('@/services/assignmentService', () => ({
  assignmentService: { get: vi.fn() },
}));

vi.mock('@/services/submissionService', () => ({
  submissionService: { create: vi.fn(), mine: vi.fn(), listForAssignment: vi.fn() },
}));

const mockedMine = vi.mocked(submissionService.mine);
const mockedList = vi.mocked(submissionService.listForAssignment);
const mockedGet = vi.mocked(assignmentService.get);

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 1,
    assignmentId: 5,
    studentId: 7,
    attemptNumber: 1,
    sourceType: 'github',
    githubUrl: 'https://github.com/thambi/repo',
    commitSha: 'abc',
    spiceLevel: 'medium',
    status: 'completed',
    errorMessage: null,
    isLate: false,
    submittedAt: '2026-10-09T10:00:00Z',
    createdAt: '2026-10-09T10:00:00Z',
    updatedAt: '2026-10-09T10:00:00Z',
    studentName: 'Karthik',
    assignmentTitle: 'Fizzbuzz Mass',
    courseId: 1,
    courseName: 'Python Basics',
    effectiveScore: 82,
    maxScore: 100,
    ...overrides,
  };
}

function page(items: Submission[], overrides: Partial<Page<Submission>> = {}): Page<Submission> {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

describe('MySubmissionsPage', { timeout: 15_000 }, () => {
  beforeEach(() => {
    mockedMine.mockReset();
  });

  it('renders submission rows with assignment, course, score and late flag', async () => {
    mockedMine.mockResolvedValue(
      page([
        makeSubmission({ id: 1 }),
        makeSubmission({
          id: 2,
          assignmentTitle: 'Linked List',
          courseName: 'DSA',
          status: 'reviewing',
          effectiveScore: null,
          isLate: true,
          sourceType: 'upload',
          attemptNumber: 2,
        }),
      ]),
    );
    renderWithProviders(<MySubmissionsPage />, { route: '/submissions', as: 'student' });

    const table = await screen.findByTestId('submissions-table');
    expect(within(table).getAllByText('Fizzbuzz Mass').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Python Basics').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('82 / 100').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Linked List').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Late').length).toBeGreaterThan(0);
    expect(within(table).getAllByLabelText('File upload').length).toBeGreaterThan(0);
    const links = within(table).getAllByRole('link', { name: 'Fizzbuzz Mass', hidden: true });
    expect(links[0]).toHaveAttribute('href', '/submissions/1');
    expect(mockedMine).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('shows the empty state with a CTA to courses', async () => {
    mockedMine.mockResolvedValue(page([]));
    renderWithProviders(<MySubmissionsPage />, { route: '/submissions', as: 'student' });

    expect(await screen.findByText('Innum onnum submit pannala, thambi!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/courses');
  });

  it('requests the next page when Next is clicked', async () => {
    const user = userEvent.setup();
    mockedMine.mockImplementation((params = {}) =>
      Promise.resolve(
        page([makeSubmission({ id: params.page === 2 ? 21 : 1 })], { total: 45, page: params.page ?? 1 }),
      ),
    );
    renderWithProviders(<MySubmissionsPage />, { route: '/submissions', as: 'student' });

    expect(await screen.findByText(/Showing 1–20 of 45/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(mockedMine).toHaveBeenCalledWith({ page: 2, pageSize: 20 }));
    expect(await screen.findByText(/Showing 21–40 of 45/)).toBeInTheDocument();
  });
});

describe('AssignmentSubmissionsPage', { timeout: 15_000 }, () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      id: 5,
      courseId: 1,
      createdBy: 9,
      title: 'Fizzbuzz Mass',
      description: '',
      language: 'python',
      dueDate: null,
      maxScore: 100,
      maxAttempts: 3,
      allowLate: false,
      isPublished: true,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });
  });

  function renderInstructorPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/assignments/:id/submissions" element={<AssignmentSubmissionsPage />} />
      </Routes>,
      { route: '/assignments/5/submissions', as: 'instructor' },
    );
  }

  it('lists student names and filters by status client-side', async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(
      page([
        makeSubmission({ id: 1, studentName: 'Karthik', status: 'completed' }),
        makeSubmission({ id: 2, studentName: 'Meena', status: 'failed', effectiveScore: null }),
      ]),
    );
    renderInstructorPage();

    const table = await screen.findByTestId('submissions-table');
    expect(within(table).getAllByText('Karthik').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Meena').length).toBeGreaterThan(0);
    expect(mockedList).toHaveBeenCalledWith(5, { page: 1, pageSize: 20 });

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'failed');
    expect(within(screen.getByTestId('submissions-table')).queryAllByText('Karthik')).toHaveLength(0);
    expect(within(screen.getByTestId('submissions-table')).getAllByText('Meena').length).toBeGreaterThan(0);
  });

  it('shows the empty state when nobody has submitted', async () => {
    mockedList.mockResolvedValue(page([]));
    renderInstructorPage();

    expect(await screen.findByText('Innum yaarum submit pannala 😴')).toBeInTheDocument();
  });

  it('shows the live indicator while a submission is in progress', async () => {
    mockedList.mockResolvedValue(page([makeSubmission({ status: 'reviewing', effectiveScore: null })]));
    renderInstructorPage();

    expect(await screen.findByText('Live — refreshing every 5s')).toBeInTheDocument();
  });
});
