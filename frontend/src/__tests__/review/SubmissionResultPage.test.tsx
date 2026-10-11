import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import SubmissionResultPage from '@/pages/SubmissionResultPage';
import { assignmentService } from '@/services/assignmentService';
import { reviewService } from '@/services/reviewService';
import { roastService } from '@/services/roastService';
import { submissionService } from '@/services/submissionService';
import type { User } from '@/types';

import { makeUser, renderWithProviders } from '../test-utils';
import {
  makeApiError,
  makeAssignment,
  makeFiles,
  makeReview,
  makeRoast,
  makeSubmission,
  STUDENT_ID,
  SUBMISSION_ID,
} from './fixtures';

vi.mock('@/services/submissionService');
vi.mock('@/services/assignmentService');
vi.mock('@/services/reviewService');
vi.mock('@/services/roastService');

// Chakra modals/menus + framer-motion are slow in jsdom under a full parallel run.
vi.setConfig({ testTimeout: 20_000 });

const student = makeUser({ id: STUDENT_ID, role: 'student' });
const instructor = makeUser({ id: 99, role: 'instructor', email: 'annae@example.com' });

function renderPage(as: User = student, search = '') {
  return renderWithProviders(
    <Routes>
      <Route path="/submissions/:id" element={<SubmissionResultPage />} />
    </Routes>,
    { route: `/submissions/${SUBMISSION_ID}${search}`, as },
  );
}

beforeAll(() => {
  // jsdom lacks Element.scrollTo (used by Chakra Menu when it opens).
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => undefined;
  }
});

beforeEach(() => {
  vi.mocked(submissionService.get).mockResolvedValue(makeSubmission());
  vi.mocked(submissionService.files).mockResolvedValue(makeFiles());
  vi.mocked(assignmentService.get).mockResolvedValue(makeAssignment());
  vi.mocked(reviewService.getForSubmission).mockResolvedValue(makeReview());
  vi.mocked(roastService.getForSubmission).mockResolvedValue(makeRoast());
});

describe('SubmissionResultPage — pipeline states', () => {
  it('shows the current step fun line while the pipeline runs', async () => {
    vi.mocked(submissionService.get).mockResolvedValue(makeSubmission({ status: 'reviewing' }));
    renderPage();

    const funLine = await screen.findByTestId('pipeline-fun-line');
    expect(funLine).toHaveTextContent('Annae code-a padichitu irukkaru...');
    expect(funLine.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('AI review')).toBeInTheDocument();
    expect(reviewService.getForSubmission).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the error and retries the submission', async () => {
    vi.mocked(submissionService.get).mockResolvedValue(
      makeSubmission({ status: 'failed', errorMessage: 'Repo kandupudikka mudiyala (404)' }),
    );
    vi.mocked(submissionService.retry).mockResolvedValue(makeSubmission({ status: 'fetching' }));
    renderPage();

    expect(await screen.findByText('Repo kandupudikka mudiyala (404)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry review/i }));

    await waitFor(() => expect(submissionService.retry).toHaveBeenCalledWith(SUBMISSION_ID));
    // Back to polling: the in-progress view replaces the error card.
    expect(await screen.findByText('Code-a download panren...', { selector: 'p' })).toBeInTheDocument();
  });

  it('renders the header with source link, attempt and spice', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Todo API' })).toBeInTheDocument();
    expect(screen.getByText(/attempt #2/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Spice level: Medium')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /github\.com\/thambi\/todo-app/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('SubmissionResultPage — review tab', () => {
  it('renders score, rubric criteria and issues', async () => {
    renderPage();

    expect(await screen.findByLabelText('Score 72 out of 100')).toBeInTheDocument();
    expect(screen.getByText('Solid CRUD endpoints but validation is thin.')).toBeInTheDocument();
    expect(screen.getByText('Correctness')).toBeInTheDocument();
    expect(screen.getByText('Code Quality')).toBeInTheDocument();
    expect(screen.getByText('40 / 50')).toBeInTheDocument();
    expect(screen.getByText('Division by zero when list is empty')).toBeInTheDocument();
    expect(screen.getByText('app.py:3')).toBeInTheDocument();
    expect(screen.getByText('Clear route naming')).toBeInTheDocument();
  });

  it('filters issues by severity', async () => {
    renderPage();
    await screen.findByText('Division by zero when list is empty');

    await userEvent.click(screen.getByRole('button', { name: /^nit \(1\)$/i }));
    expect(screen.queryByText('Division by zero when list is empty')).not.toBeInTheDocument();
    expect(screen.getByText('Inconsistent naming')).toBeInTheDocument();
  });

  it('opens the CodeViewer at the issue file and highlights the line', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Division by zero when list is empty'));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByTestId('code-viewer-file')).toHaveTextContent('src/app.py');
    expect(submissionService.files).toHaveBeenCalledWith(SUBMISSION_ID);

    const highlighted = dialog.querySelector('[data-highlighted="true"]');
    expect(highlighted).not.toBeNull();
    expect(highlighted).toHaveAttribute('data-line', '3');
    expect(highlighted).toHaveTextContent('return total / len(xs)');
  });

  it('shows the instructor override banner with the original AI score', async () => {
    vi.mocked(reviewService.getForSubmission).mockResolvedValue(
      makeReview({ instructorOverrideScore: 85, effectiveScore: 85, instructorComment: 'Edge cases handled in README' }),
    );
    renderPage();

    const banner = await screen.findByTestId('override-banner');
    expect(banner).toHaveTextContent('85 / 100');
    expect(banner).toHaveTextContent('Original AI score: 72 / 100');
    expect(banner).toHaveTextContent('Edge cases handled in README');
  });

  it('lets an instructor override the score with a comment', async () => {
    vi.mocked(reviewService.override).mockResolvedValue(
      makeReview({ instructorOverrideScore: 80, effectiveScore: 80, instructorComment: 'Nice tests' }),
    );
    renderPage(instructor);

    await userEvent.click(await screen.findByRole('button', { name: /override score/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: /override score/i }));
    await userEvent.paste('80');
    await userEvent.click(within(dialog).getByRole('textbox', { name: /comment/i }));
    await userEvent.paste('Nice tests');
    await userEvent.click(within(dialog).getByRole('button', { name: /save override/i }));

    await waitFor(() =>
      expect(reviewService.override).toHaveBeenCalledWith(11, { overrideScore: 80, comment: 'Nice tests' }),
    );
    expect(await screen.findByLabelText('Score 80 out of 100')).toBeInTheDocument();
  });

  it('rejects an out-of-range override score', async () => {
    renderPage(instructor);
    await userEvent.click(await screen.findByRole('button', { name: /override score/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: /override score/i }));
    await userEvent.paste('150');

    expect(within(dialog).getByText('Score must be between 0 and 100.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /save override/i })).toBeDisabled();
  });

  it('confirms and starts a re-review (instructor)', async () => {
    vi.mocked(reviewService.reReview).mockResolvedValue(makeSubmission({ status: 'reviewing' }));
    renderPage(instructor);

    await userEvent.click(await screen.findByRole('button', { name: /re-run ai review/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Review and roast will be regenerated');
    await userEvent.click(within(dialog).getByRole('button', { name: /^re-run review$/i }));

    await waitFor(() => expect(reviewService.reReview).toHaveBeenCalledWith(SUBMISSION_ID));
    expect(await screen.findByText('Annae code-a padichitu irukkaru...')).toBeInTheDocument();
  });

  it('does not show instructor controls to the owner student', async () => {
    renderPage(student);
    await screen.findByLabelText('Score 72 out of 100');

    expect(screen.queryByRole('button', { name: /override score/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-run ai review/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /roast/i }));
    await screen.findByTestId('roast-punchline');
    expect(screen.queryByRole('checkbox', { name: /hide roast/i })).not.toBeInTheDocument();
  });
});

describe('SubmissionResultPage — roast tab', () => {
  it('shows the punchline and remaining regenerations (from ?tab=roast)', async () => {
    renderPage(student, '?tab=roast');

    expect(await screen.findByTestId('roast-punchline')).toHaveTextContent('Un code Vaigai aathu maari — full-a dry!');
    expect(screen.getByRole('tab', { name: /roast/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Spice level: Medium (2 of 3 chilies)')).toBeInTheDocument();
    expect(screen.getByTestId('regenerate-remaining')).toHaveTextContent('1 of 2 regenerations left');
  });

  it('regenerates with a new spice level', async () => {
    vi.mocked(roastService.regenerate).mockResolvedValue(
      makeRoast({ spiceLevel: 'mass', regenerateCount: 2, punchline: 'Madurai mass punchline!' }),
    );
    renderPage(student, '?tab=roast');

    await userEvent.click(await screen.findByRole('button', { name: /innoru roast venum/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /madurai mass/i }));

    await waitFor(() => expect(roastService.regenerate).toHaveBeenCalledWith(21, { spiceLevel: 'mass' }));
    expect(await screen.findByText(/madurai mass punchline/i)).toBeInTheDocument();
    expect(screen.getByTestId('regenerate-remaining')).toHaveTextContent(/limit reached/i);
    expect(screen.getByRole('button', { name: /innoru roast venum/i })).toBeDisabled();
  });

  it('shares the roast and shows the public link', async () => {
    vi.mocked(roastService.setShared).mockResolvedValue(makeRoast({ isShared: true, shareSlug: 'gethu-42' }));
    renderPage(student, '?tab=roast');

    await userEvent.click(await screen.findByRole('checkbox', { name: /roast wall-la share pannu/i }));

    await waitFor(() => expect(roastService.setShared).toHaveBeenCalledWith(21, true));
    expect(await screen.findByLabelText('Public link')).toHaveValue(`${window.location.origin}/r/gethu-42`);
    expect(screen.getByRole('button', { name: /copy public link/i })).toBeInTheDocument();
  });

  it('shows a neutral state when the roast is not available (hidden → 404)', async () => {
    vi.mocked(roastService.getForSubmission).mockRejectedValue(makeApiError(404, 'NOT_FOUND', 'Roast not found'));
    renderPage(student, '?tab=roast');

    expect(await screen.findByText('Roast not available')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets an instructor hide the roast', async () => {
    vi.mocked(roastService.setHidden).mockResolvedValue(makeRoast({ isHidden: true }));
    renderPage(instructor, '?tab=roast');

    await userEvent.click(await screen.findByRole('checkbox', { name: /hide roast from student/i }));
    await waitFor(() => expect(roastService.setHidden).toHaveBeenCalledWith(21, true));
    expect(await screen.findByText('Hidden from student')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /innoru roast venum/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /share pannu/i })).not.toBeInTheDocument();
  });
});
