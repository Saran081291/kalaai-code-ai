import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubmitPage from '@/pages/SubmitPage';
import { assignmentService } from '@/services/assignmentService';
import { submissionService } from '@/services/submissionService';
import type { Assignment, Submission } from '@/types';

import { makeUser, renderWithProviders } from '../test-utils';

vi.mock('@/services/assignmentService', () => ({
  assignmentService: { get: vi.fn() },
}));

vi.mock('@/services/submissionService', () => ({
  submissionService: { create: vi.fn(), mine: vi.fn(), listForAssignment: vi.fn() },
}));

const mockedGet = vi.mocked(assignmentService.get);
const mockedCreate = vi.mocked(submissionService.create);

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 5,
    courseId: 1,
    createdBy: 9,
    title: 'Fizzbuzz Mass',
    description: 'Write fizzbuzz',
    language: 'python',
    dueDate: '2099-01-01T00:00:00Z',
    maxScore: 100,
    maxAttempts: 3,
    allowLate: false,
    isPublished: true,
    myAttemptsCount: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 42,
    assignmentId: 5,
    studentId: 1,
    attemptNumber: 2,
    sourceType: 'github',
    githubUrl: 'https://github.com/thambi/fizzbuzz',
    commitSha: null,
    spiceLevel: 'mass',
    status: 'pending',
    errorMessage: null,
    isLate: false,
    submittedAt: '2026-10-10T00:00:00Z',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    ...overrides,
  };
}

function apiError(status: number, code: string, detail: string): AxiosError {
  return new AxiosError(detail, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    data: { detail, code },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/assignments/:id/submit" element={<SubmitPage />} />
      <Route path="/submissions/:id" element={<div>Result page</div>} />
    </Routes>,
    { route: '/assignments/5/submit', as: makeUser({ role: 'student', defaultSpiceLevel: 'mass' }) },
  );
}

describe('SubmitPage', { timeout: 15_000 }, () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedCreate.mockReset();
  });

  it('shows assignment info and defaults the spice level from the user', async () => {
    mockedGet.mockResolvedValue(makeAssignment());
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Fizzbuzz Mass' })).toBeInTheDocument();
    expect(screen.getByTestId('attempts-remaining')).toHaveTextContent('2 of 3 attempts left');
    expect(screen.getByRole('radio', { name: /^Madurai Mass/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Roast code-ku mattum dhaan, person-ku illa 🙏')).toBeInTheDocument();
  });

  it('labels the next attempt with the number the server will assign', async () => {
    // One counted attempt, but a refunded failed fetch already took #2.
    mockedGet.mockResolvedValue(makeAssignment({ myAttemptsCount: 1, myNextAttemptNumber: 3 }));
    renderPage();

    expect(await screen.findByText('This will be attempt #3')).toBeInTheDocument();
  });

  it('falls back to attempts used + 1 when the server sends no next attempt number', async () => {
    mockedGet.mockResolvedValue(makeAssignment({ myAttemptsCount: 1 }));
    renderPage();

    expect(await screen.findByText('This will be attempt #2')).toBeInTheDocument();
  });

  it('submits a GitHub URL and navigates to the result page', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(makeAssignment());
    mockedCreate.mockResolvedValue(makeSubmission());
    renderPage();

    await user.click(await screen.findByLabelText(/GitHub repository URL/));
    await user.paste('https://github.com/thambi/fizzbuzz');
    await user.click(screen.getByRole('button', { name: /Submit for review/ }));

    expect(await screen.findByText('Result page')).toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledWith(5, {
      spiceLevel: 'mass',
      githubUrl: 'https://github.com/thambi/fizzbuzz',
    });
  });

  it('blocks an invalid GitHub URL client-side', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(makeAssignment());
    renderPage();

    await user.click(await screen.findByLabelText(/GitHub repository URL/));
    await user.paste('https://gitlab.com/x/y');
    await user.click(screen.getByRole('button', { name: /Submit for review/ }));

    expect(screen.getByText(/Enter a public GitHub repository URL/)).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('submits uploaded files with the selected spice level', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(makeAssignment());
    mockedCreate.mockResolvedValue(makeSubmission({ sourceType: 'upload' }));
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /Upload files/ }));
    const file = new File(['print(1)'], 'main.py', { type: 'text/x-python' });
    fireEvent.drop(screen.getByTestId('file-dropzone'), { dataTransfer: { files: [file] } });
    await user.click(screen.getByRole('radio', { name: /^Mild/ }));
    await user.click(screen.getByRole('button', { name: /Submit for review/ }));

    expect(await screen.findByText('Result page')).toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledWith(5, { spiceLevel: 'mild', files: [file] });
  });

  it('shows a friendly message for ATTEMPT_LIMIT', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(makeAssignment());
    mockedCreate.mockRejectedValue(apiError(409, 'ATTEMPT_LIMIT', 'Attempt limit reached'));
    renderPage();

    await user.click(await screen.findByLabelText(/GitHub repository URL/));
    await user.paste('https://github.com/thambi/fizzbuzz');
    await user.click(screen.getByRole('button', { name: /Submit for review/ }));

    expect(await screen.findByText(/You have used all your attempts for this assignment/)).toBeInTheDocument();
    expect(screen.queryByText('Result page')).not.toBeInTheDocument();
  });

  it('disables submit when no attempts are left', async () => {
    mockedGet.mockResolvedValue(makeAssignment({ myAttemptsCount: 3 }));
    renderPage();

    expect(await screen.findByText('No attempts left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for review/ })).toBeDisabled();
  });

  it('disables submit when past due and late submissions are not allowed', async () => {
    mockedGet.mockResolvedValue(makeAssignment({ dueDate: '2020-01-01T00:00:00Z', allowLate: false }));
    renderPage();

    expect(await screen.findByText('Submissions closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for review/ })).toBeDisabled();
  });

  it('warns but allows submit when past due with allowLate', async () => {
    mockedGet.mockResolvedValue(makeAssignment({ dueDate: '2020-01-01T00:00:00Z', allowLate: true }));
    renderPage();

    expect(await screen.findByText(/this submission will be marked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for review/ })).toBeEnabled();
  });
});
