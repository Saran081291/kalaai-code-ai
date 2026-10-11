import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useReview, useRoast } from '@/hooks/useReview';
import {
  getSubmissionRefetchInterval,
  SUBMISSION_POLL_INTERVAL_MS,
  useSubmissionStatus,
} from '@/hooks/useSubmissionStatus';
import { createQueryClient } from '@/lib/queryClient';
import { reviewService } from '@/services/reviewService';
import { roastService } from '@/services/roastService';
import { submissionService } from '@/services/submissionService';

import { makeApiError, makeSubmission, SUBMISSION_ID } from './fixtures';

vi.mock('@/services/submissionService');
vi.mock('@/services/reviewService');
vi.mock('@/services/roastService');

function setup() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('getSubmissionRefetchInterval', () => {
  it('polls every 2s until the pipeline is terminal', () => {
    expect(SUBMISSION_POLL_INTERVAL_MS).toBe(2000);
    expect(getSubmissionRefetchInterval(undefined)).toBe(2000);
    expect(getSubmissionRefetchInterval('pending')).toBe(2000);
    expect(getSubmissionRefetchInterval('fetching')).toBe(2000);
    expect(getSubmissionRefetchInterval('reviewing')).toBe(2000);
    expect(getSubmissionRefetchInterval('roasting')).toBe(2000);
    expect(getSubmissionRefetchInterval('completed')).toBe(false);
    expect(getSubmissionRefetchInterval('failed')).toBe(false);
  });
});

describe('useSubmissionStatus', () => {
  it('invalidates review + roast when the submission becomes completed', async () => {
    vi.mocked(submissionService.get)
      .mockResolvedValueOnce(makeSubmission({ status: 'roasting' }))
      .mockResolvedValue(makeSubmission({ status: 'completed' }));
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSubmissionStatus(SUBMISSION_ID), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('roasting'));
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.status).toBe('completed'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['review', SUBMISSION_ID] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['roast', SUBMISSION_ID] });
  });

  it('does not fetch for an invalid id', () => {
    const { wrapper } = setup();
    renderHook(() => useSubmissionStatus(undefined), { wrapper });
    expect(submissionService.get).not.toHaveBeenCalled();
  });
});

describe('useReview / useRoast', () => {
  it('treats 404 *_NOT_READY as "not yet" (null) instead of an error', async () => {
    vi.mocked(reviewService.getForSubmission).mockRejectedValue(makeApiError(404, 'REVIEW_NOT_READY'));
    vi.mocked(roastService.getForSubmission).mockRejectedValue(makeApiError(404, 'ROAST_NOT_READY'));
    const { wrapper } = setup();

    const review = renderHook(() => useReview(SUBMISSION_ID, true), { wrapper });
    const roast = renderHook(() => useRoast(SUBMISSION_ID, true), { wrapper });

    await waitFor(() => expect(review.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(roast.result.current.isSuccess).toBe(true));
    expect(review.result.current.data).toBeNull();
    expect(roast.result.current.data).toBeNull();
  });

  it('surfaces other errors', async () => {
    vi.mocked(reviewService.getForSubmission).mockRejectedValue(makeApiError(500, 'INTERNAL'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReview(SUBMISSION_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fetch while disabled', () => {
    const { wrapper } = setup();
    renderHook(() => useReview(SUBMISSION_ID, false), { wrapper });
    expect(reviewService.getForSubmission).not.toHaveBeenCalled();
  });
});
