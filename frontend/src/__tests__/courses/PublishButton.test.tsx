import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PublishButton } from '@/components/assignments/PublishButton';
import { assignmentService } from '@/services/assignmentService';

import { renderWithProviders } from '../test-utils';
import { apiError, makeAssignment, makeCriterion } from './fixtures';

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

describe('PublishButton', () => {
  it('is disabled with an explanation when the rubric total does not match', () => {
    const assignment = makeAssignment({
      isPublished: false,
      maxScore: 100,
      rubricCriteria: [makeCriterion({ maxPoints: 60 })],
    });
    renderWithProviders(<PublishButton assignment={assignment} />, { as: 'instructor' });

    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
    expect(screen.getByTestId('publish-block-reason')).toHaveTextContent('Saved rubric total (60) must equal the max score (100)');
  });

  it('is disabled when there are no criteria', () => {
    renderWithProviders(<PublishButton assignment={makeAssignment({ isPublished: false, rubricCriteria: [] })} />, {
      as: 'instructor',
    });
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
    expect(screen.getByTestId('publish-block-reason')).toHaveTextContent(/at least one rubric criterion/);
  });

  it('is disabled while there are unsaved changes', () => {
    renderWithProviders(<PublishButton assignment={makeAssignment({ isPublished: false })} hasUnsavedChanges />, {
      as: 'instructor',
    });
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
  });

  it('publishes when the rubric adds up, and surfaces RUBRIC_TOTAL_MISMATCH errors', async () => {
    const user = userEvent.setup({ delay: null });
    const assignment = makeAssignment({ isPublished: false });
    vi.mocked(assignmentService.publish).mockRejectedValueOnce(apiError(400, 'RUBRIC_TOTAL_MISMATCH'));
    renderWithProviders(<PublishButton assignment={assignment} />, { as: 'instructor' });

    const button = screen.getByRole('button', { name: /publish/i });
    expect(button).toBeEnabled();
    await user.click(button);

    expect(assignmentService.publish).toHaveBeenCalledWith(assignment.id);
    expect(await screen.findByText('Rubric points must add up exactly to the max score.')).toBeInTheDocument();
  });

  it('shows a Published badge once published', () => {
    renderWithProviders(<PublishButton assignment={makeAssignment({ isPublished: true })} />, { as: 'instructor' });
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
  });
});
