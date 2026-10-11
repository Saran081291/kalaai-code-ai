import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { fromDateTimeLocal, toDateTimeLocal } from '@/components/assignments/dateUtils';
import type { AssignmentCreateRequest } from '@/types';

import { renderWithProviders } from '../test-utils';

describe('AssignmentForm', { timeout: 30_000 }, () => {
  it('builds a create payload with rubric positions and an ISO due date', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn<(payload: AssignmentCreateRequest) => void>();
    renderWithProviders(<AssignmentForm withRubric onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Title/), 'FizzBuzz');
    await user.type(screen.getByLabelText(/^Description/), 'Write FizzBuzz');
    await user.selectOptions(screen.getByLabelText(/^Language/), 'typescript');
    fireEvent.change(screen.getByLabelText(/^Due date/), { target: { value: '2026-12-01T18:30' } });
    await user.clear(screen.getByLabelText(/^Max score/));
    await user.type(screen.getByLabelText(/^Max score/), '50');
    await user.clear(screen.getByLabelText(/^Max attempts/));
    await user.type(screen.getByLabelText(/^Max attempts/), '2');
    await user.click(screen.getByLabelText(/allow late submissions/i));

    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    await user.type(screen.getByLabelText('Criterion 1 name'), 'Correctness');
    await user.type(screen.getByLabelText('Criterion 1 points'), '30');
    await user.type(screen.getByLabelText('Criterion 1 description'), 'Works');
    await user.type(screen.getByLabelText('Criterion 2 name'), 'Style');
    await user.type(screen.getByLabelText('Criterion 2 points'), '20');
    // Reorder: Style first.
    await user.click(screen.getByRole('button', { name: 'Move criterion 2 up' }));

    await user.click(screen.getByRole('button', { name: /create assignment/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]?.[0];
    const expectedDue = new Date('2026-12-01T18:30').toISOString();
    expect(payload).toEqual({
      title: 'FizzBuzz',
      description: 'Write FizzBuzz',
      language: 'typescript',
      dueDate: expectedDue,
      maxScore: 50,
      maxAttempts: 2,
      allowLate: true,
      rubricCriteria: [
        { name: 'Style', description: '', maxPoints: 20, position: 0 },
        { name: 'Correctness', description: 'Works', maxPoints: 30, position: 1 },
      ],
    });
    expect(payload?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('blocks submit when the rubric total does not match the max score', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    renderWithProviders(<AssignmentForm withRubric onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Title/), 'FizzBuzz');
    await user.type(screen.getByLabelText(/^Description/), 'Write FizzBuzz');
    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    await user.type(screen.getByLabelText('Criterion 1 name'), 'Correctness');
    await user.type(screen.getByLabelText('Criterion 1 points'), '30');
    await user.click(screen.getByRole('button', { name: /create assignment/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Rubric total \(30\) must equal the max score \(100\)/)).toBeInTheDocument();
  });

  it('requires title and description and sends a null due date when empty', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn<(payload: AssignmentCreateRequest) => void>();
    renderWithProviders(<AssignmentForm withRubric onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create assignment/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Title/), 'Draft');
    await user.type(screen.getByLabelText(/^Description/), 'Later');
    await user.click(screen.getByRole('button', { name: /create assignment/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ dueDate: null, maxScore: 100, maxAttempts: 3, rubricCriteria: [] });
  });

  it('round-trips datetime-local values', () => {
    const iso = fromDateTimeLocal('2026-12-01T18:30');
    expect(iso).not.toBeNull();
    expect(toDateTimeLocal(iso)).toBe('2026-12-01T18:30');
    expect(fromDateTimeLocal('')).toBeNull();
  });
});
