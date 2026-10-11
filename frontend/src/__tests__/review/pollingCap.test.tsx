import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SUBMISSION_POLL_MAX_MS, useSubmissionStatus } from '@/hooks/useSubmissionStatus';
import { createQueryClient } from '@/lib/queryClient';
import { submissionService } from '@/services/submissionService';

import { makeSubmission, SUBMISSION_ID } from './fixtures';

vi.mock('@/services/submissionService');

describe('useSubmissionStatus polling cap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling after ~5 minutes of non-terminal status and can be restarted', async () => {
    vi.mocked(submissionService.get).mockResolvedValue(makeSubmission({ status: 'reviewing' }));
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSubmissionStatus(SUBMISSION_ID), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.pollingTimedOut).toBe(false);
    expect(vi.mocked(submissionService.get).mock.calls.length).toBeGreaterThan(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUBMISSION_POLL_MAX_MS + 5_000);
    });
    expect(result.current.pollingTimedOut).toBe(true);

    const callsAtTimeout = vi.mocked(submissionService.get).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(vi.mocked(submissionService.get).mock.calls.length).toBe(callsAtTimeout);

    await act(async () => {
      result.current.restartPolling();
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(result.current.pollingTimedOut).toBe(false);
    expect(vi.mocked(submissionService.get).mock.calls.length).toBeGreaterThan(callsAtTimeout);
  });
});
