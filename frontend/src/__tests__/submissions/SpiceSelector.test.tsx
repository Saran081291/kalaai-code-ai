import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SpiceSelector } from '@/components/submissions/SpiceSelector';
import type { SpiceLevel } from '@/types';

import { renderWithProviders } from '../test-utils';

function Harness({ initial, onChange }: { initial: SpiceLevel; onChange?: (level: SpiceLevel) => void }) {
  const [value, setValue] = useState<SpiceLevel>(initial);
  return (
    <SpiceSelector
      value={value}
      onChange={(level) => {
        setValue(level);
        onChange?.(level);
      }}
    />
  );
}

function radio(label: RegExp) {
  return screen.getByRole('radio', { name: label });
}

describe('SpiceSelector', { timeout: 15_000 }, () => {
  it('renders a radiogroup with three spice cards', () => {
    renderWithProviders(<Harness initial="medium" />);

    expect(screen.getByRole('radiogroup', { name: 'Roast spice level' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Madurai Mass')).toBeInTheDocument();
    expect(radio(/^Medium/)).toHaveAttribute('aria-checked', 'true');
    expect(radio(/^Medium/)).toHaveAttribute('tabindex', '0');
    expect(radio(/^Mild/)).toHaveAttribute('tabindex', '-1');
  });

  it('selects a card on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness initial="mild" onChange={onChange} />);

    await user.click(radio(/^Madurai Mass/));
    expect(onChange).toHaveBeenCalledWith('mass');
    expect(radio(/^Madurai Mass/)).toHaveAttribute('aria-checked', 'true');
    expect(radio(/^Mild/)).toHaveAttribute('aria-checked', 'false');
  });

  it('supports arrow-key navigation with focus following selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial="mild" />);

    await user.tab();
    expect(radio(/^Mild/)).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio(/^Medium/)).toHaveAttribute('aria-checked', 'true');
    expect(radio(/^Medium/)).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio(/^Madurai Mass/)).toHaveAttribute('aria-checked', 'true');

    // wraps around
    await user.keyboard('{ArrowRight}');
    expect(radio(/^Mild/)).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(radio(/^Madurai Mass/)).toHaveAttribute('aria-checked', 'true');
    expect(radio(/^Madurai Mass/)).toHaveFocus();
  });
});
