import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PublicRoastPage from '@/pages/PublicRoastPage';
import { roastService } from '@/services/roastService';

import { renderWithProviders } from '../test-utils';
import { makeApiError, makePublicRoast } from './fixtures';

vi.mock('@/services/roastService');

const getPublic = vi.mocked(roastService.getPublic);

function renderPublic(slug = 'abc123XYZ_') {
  return renderWithProviders(
    <Routes>
      <Route path="/r/:slug" element={<PublicRoastPage />} />
    </Routes>,
    { route: `/r/${slug}` },
  );
}

afterEach(() => {
  document.title = '';
});

describe('PublicRoastPage', () => {
  it('renders the punchline and first name without any email', async () => {
    getPublic.mockResolvedValue(makePublicRoast());
    const { container } = renderPublic();

    expect(await screen.findByText(/Jigarthanda kudutha kooda sweet aagadhu/)).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByLabelText('Score 31 out of 50')).toBeInTheDocument();
    expect(getPublic).toHaveBeenCalledWith('abc123XYZ_');
    expect(container.textContent ?? '').not.toMatch(/@/);

    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get roasted too/i })).toHaveAttribute('href', '/register');
    await waitFor(() => expect(document.title).toContain('Jigarthanda kudutha kooda sweet aagadhu'));
  });

  it('copies the link to the clipboard', async () => {
    getPublic.mockResolvedValue(makePublicRoast());
    const user = userEvent.setup();
    renderPublic();

    await user.click(await screen.findByRole('button', { name: /copy link/i }));

    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toContain('/r/abc123XYZ_');
  });

  it('shows the not-found state for an unknown or unshared slug', async () => {
    getPublic.mockRejectedValue(makeApiError(404, 'NOT_FOUND', 'Roast not found'));
    renderPublic('missing');

    expect(await screen.findByText('Indha roast-a kaanom! Maybe unshare panniyirukkaanga.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get roasted too/i })).toBeInTheDocument();
  });
});
