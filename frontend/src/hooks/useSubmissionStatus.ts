import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { assignmentService } from '@/services/assignmentService';
import { submissionService } from '@/services/submissionService';
import { TERMINAL_SUBMISSION_STATUSES, type Submission, type SubmissionStatus } from '@/types';

/** Poll cadence while the AI pipeline runs. */
export const SUBMISSION_POLL_INTERVAL_MS = 2000;

/** Stop polling after this long without a terminal status (pipeline stuck / worker down). */
export const SUBMISSION_POLL_MAX_MS = 5 * 60 * 1000;

export const submissionKeys = {
  detail: (id: number) => ['submission', id] as const,
  files: (id: number) => ['submissionFiles', id] as const,
};

export function isTerminalStatus(status: SubmissionStatus | undefined): boolean {
  return status !== undefined && TERMINAL_SUBMISSION_STATUSES.includes(status);
}

/** `refetchInterval` for a submission: poll every 2s until completed/failed. */
export function getSubmissionRefetchInterval(status: SubmissionStatus | undefined): number | false {
  return isTerminalStatus(status) ? false : SUBMISSION_POLL_INTERVAL_MS;
}

function isValidId(id: number | undefined): id is number {
  return id !== undefined && Number.isInteger(id) && id > 0;
}

/**
 * Submission detail with live polling. When the pipeline finishes (`completed`),
 * the cached review + roast are invalidated so the result tabs load fresh data.
 */
export function useSubmissionStatus(id: number | undefined) {
  const queryClient = useQueryClient();
  // When polling of this submission began (reset on id change / manual restart).
  const pollStartedAt = useRef<number>(Date.now());
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  useEffect(() => {
    pollStartedAt.current = Date.now();
    setPollingTimedOut(false);
  }, [id]);

  const query = useQuery({
    queryKey: submissionKeys.detail(id ?? 0),
    queryFn: () => submissionService.get(id as number),
    enabled: isValidId(id),
    staleTime: 0,
    refetchInterval: (q) => {
      if (q.state.status === 'error') return false;
      if (Date.now() - pollStartedAt.current >= SUBMISSION_POLL_MAX_MS) return false;
      return getSubmissionRefetchInterval(q.state.data?.status);
    },
  });

  const status = query.data?.status;
  const previousStatus = useRef<SubmissionStatus | undefined>(undefined);

  useEffect(() => {
    const prev = previousStatus.current;
    previousStatus.current = status;
    if (!isValidId(id) || status !== 'completed' || prev === undefined || prev === 'completed') return;
    void queryClient.invalidateQueries({ queryKey: ['review', id] });
    void queryClient.invalidateQueries({ queryKey: ['roast', id] });
  }, [id, status, queryClient]);

  // Flag the timeout (and stop polling) once the cap elapses while still non-terminal.
  const terminal = isTerminalStatus(status);
  useEffect(() => {
    if (!isValidId(id) || terminal) return undefined;
    const remaining = Math.max(0, SUBMISSION_POLL_MAX_MS - (Date.now() - pollStartedAt.current));
    const timer = setTimeout(() => setPollingTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [id, terminal, pollingTimedOut]);

  const { refetch } = query;
  /** Reset the polling window and fetch again. */
  const restartPolling = useCallback(() => {
    pollStartedAt.current = Date.now();
    setPollingTimedOut(false);
    void refetch();
  }, [refetch]);

  return { ...query, pollingTimedOut: pollingTimedOut && !terminal, restartPolling };
}

/** Assignment info (title, maxScore) for the result header. Shares the `['assignment', id]` cache. */
export function useSubmissionAssignment(assignmentId: number | undefined) {
  return useQuery({
    queryKey: ['assignment', assignmentId ?? 0],
    queryFn: () => assignmentService.get(assignmentId as number),
    enabled: isValidId(assignmentId),
  });
}

/** Retry a failed submission; the returned (pending) submission restarts polling. */
export function useRetrySubmission(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => submissionService.retry(submissionId),
    onSuccess: (submission: Submission) => {
      queryClient.setQueryData(submissionKeys.detail(submissionId), submission);
    },
  });
}
