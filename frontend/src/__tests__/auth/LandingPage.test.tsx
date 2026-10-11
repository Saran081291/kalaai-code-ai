import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import LandingPage from '@/pages/LandingPage';

import { renderWithProviders } from '../test-utils';
import { TEST_TIMEOUT } from './helpers';

describe('LandingPage', { timeout: TEST_TIMEOUT }, () => {
  it('shows the hero, steps and signed-out CTAs', () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole('heading', { name: /code review \+ madurai roast/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /^login$/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /go to dashboard/i })).not.toBeInTheDocument();
    expect(screen.getByText(/roasts target the code, never the person/i)).toBeInTheDocument();
  });

  it('shows a dashboard CTA when signed in', () => {
    renderWithProviders(<LandingPage />, { as: 'student' });
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
  });

  it('switches the sample roast with the spice selector', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    const sample = () => screen.getByTestId('spice-demo-sample');
    expect(sample()).toHaveAttribute('data-spice', 'medium');
    expect(sample()).toHaveTextContent(/try\/except/i);

    await user.click(screen.getByRole('radio', { name: 'Madurai Mass' }));
    expect(sample()).toHaveAttribute('data-spice', 'mass');
    expect(sample()).toHaveTextContent(/Chithirai thiruvizha crowd/);

    await user.click(screen.getByRole('radio', { name: 'Mild' }));
    expect(sample()).toHaveAttribute('data-spice', 'mild');
    expect(sample()).toHaveTextContent(/Mattuthavani bus stand/);
  });
});
