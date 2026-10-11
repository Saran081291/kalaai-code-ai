import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { autoBalance, emptyCriterion, type RubricCriterionDraft } from '@/components/assignments/rubric';
import { RubricBuilder } from '@/components/assignments/RubricBuilder';

import { renderWithProviders } from '../test-utils';

function Harness({ maxScore = 100, initial = [] }: { maxScore?: number; initial?: RubricCriterionDraft[] }) {
  const [criteria, setCriteria] = useState<RubricCriterionDraft[]>(initial);
  return <RubricBuilder criteria={criteria} onChange={setCriteria} maxScore={maxScore} />;
}

function indicator() {
  return screen.getByRole('status');
}

describe('RubricBuilder', { timeout: 20_000 }, () => {
  it('adds criteria and updates the live total indicator', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Harness maxScore={100} />);

    expect(screen.getByText('No criteria yet')).toBeInTheDocument();
    expect(indicator()).toHaveTextContent('Rubric total: 0 / 100');
    expect(indicator()).toHaveAttribute('data-state', 'mismatch');

    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    expect(screen.getAllByTestId('rubric-row')).toHaveLength(2);

    await user.type(screen.getByLabelText('Criterion 1 points'), '60');
    expect(indicator()).toHaveTextContent('Rubric total: 60 / 100');
    expect(indicator()).toHaveTextContent('40 points short');

    await user.type(screen.getByLabelText('Criterion 2 points'), '50');
    expect(indicator()).toHaveTextContent('10 points over');
    expect(indicator()).toHaveAttribute('data-state', 'mismatch');

    await user.clear(screen.getByLabelText('Criterion 2 points'));
    await user.type(screen.getByLabelText('Criterion 2 points'), '40');
    expect(indicator()).toHaveTextContent('Matches max score');
    expect(indicator()).toHaveAttribute('data-state', 'match');
  });

  it('removes and reorders criteria', async () => {
    const user = userEvent.setup({ delay: null });
    const initial = [
      { ...emptyCriterion(), name: 'Correctness', maxPoints: '70' },
      { ...emptyCriterion(), name: 'Style', maxPoints: '30' },
    ];
    renderWithProviders(<Harness maxScore={100} initial={initial} />);
    expect(indicator()).toHaveAttribute('data-state', 'match');

    await user.click(screen.getByRole('button', { name: 'Move criterion 2 up' }));
    expect(screen.getByLabelText('Criterion 1 name')).toHaveValue('Style');
    expect(screen.getByLabelText('Criterion 2 name')).toHaveValue('Correctness');
    expect(screen.getByRole('button', { name: 'Move criterion 1 up' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Remove criterion 1' }));
    const rows = screen.getAllByTestId('rubric-row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByLabelText('Criterion 1 name')).toHaveValue('Correctness');
    expect(indicator()).toHaveTextContent('Rubric total: 70 / 100');
    expect(indicator()).toHaveTextContent('30 points short');
  });

  it('auto-balances points across criteria', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Harness maxScore={100} initial={[emptyCriterion(), emptyCriterion(), emptyCriterion()]} />);

    await user.click(screen.getByRole('button', { name: /auto-balance/i }));
    expect(screen.getByLabelText('Criterion 1 points')).toHaveValue(34);
    expect(screen.getByLabelText('Criterion 2 points')).toHaveValue(33);
    expect(screen.getByLabelText('Criterion 3 points')).toHaveValue(33);
    expect(indicator()).toHaveAttribute('data-state', 'match');
  });

  it('autoBalance helper keeps the sum equal to maxScore', () => {
    const balanced = autoBalance([emptyCriterion(), emptyCriterion(), emptyCriterion(), emptyCriterion()], 10);
    expect(balanced.map((c) => c.maxPoints)).toEqual(['3', '3', '2', '2']);
  });
});
