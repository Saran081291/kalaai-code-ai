import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { submissionKeys } from '@/hooks/useSubmissionStatus';
import { getErrorCode, getErrorStatus } from '@/services/api';
import { reviewService } from '@/services/reviewService';
import { roastService } from '@/services/roastService';
import { submissionService } from '@/services/submissionService';
import type { Review, ReviewOverrideRequest, Roast, SpiceLevel, Submission } from '@/types';

/** Max roast regenerations per submission (backend answers 409 REGENERATE_LIMIT after this). */
export const REGENERATE_LIMIT = 2;

export const reviewKeys = {
  review: (submissionId: number) => ['review', submissionId] as const,
  roast: (submissionId: number) => ['roast', submissionId] as const,
};

/**
 * 404 means "not ready yet" (REVIEW_NOT_READY / ROAST_NOT_READY) or, for students, "hidden roast".
 * Both resolve to `null` so the UI shows a neutral state instead of an error.
 */
async function nullIfNotFound<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (err) {
    if (getErrorStatus(err) === 404) return null;
    throw err;
  }
}

/** Review of a submission; `data === null` → not ready. */
export function useReview(submissionId: number, enabled: boolean) {
  return useQuery<Review | null>({
    queryKey: reviewKeys.review(submissionId),
    queryFn: () => nullIfNotFound(() => reviewService.getForSubmission(submissionId)),
    enabled,
    retry: false,
  });
}

/** Roast of a submission; `data === null` → not ready / not available (hidden for students). */
export function useRoast(submissionId: number, enabled: boolean) {
  return useQuery<Roast | null>({
    queryKey: reviewKeys.roast(submissionId),
    queryFn: () => nullIfNotFound(() => roastService.getForSubmission(submissionId)),
    enabled,
    retry: false,
  });
}

/** Lazy-loaded code files for the CodeViewer. */
export function useSubmissionFiles(submissionId: number, enabled: boolean) {
  return useQuery({
    queryKey: submissionKeys.files(submissionId),
    queryFn: () => submissionService.files(submissionId),
    enabled,
    staleTime: Infinity,
  });
}

export interface OverrideReviewVariables {
  reviewId: number;
  body: ReviewOverrideRequest;
}

/** Instructor: set/clear the score override. */
export function useOverrideReview(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, body }: OverrideReviewVariables) => reviewService.override(reviewId, body),
    onSuccess: (review: Review) => {
      queryClient.setQueryData(reviewKeys.review(submissionId), review);
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/** Instructor: discard review + roast and re-run the AI. Polling resumes from the returned status. */
export function useReReview(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reviewService.reReview(submissionId),
    onSuccess: (submission: Submission) => {
      queryClient.removeQueries({ queryKey: reviewKeys.review(submissionId) });
      queryClient.removeQueries({ queryKey: reviewKeys.roast(submissionId) });
      queryClient.setQueryData(submissionKeys.detail(submissionId), submission);
    },
  });
}

export interface RegenerateRoastVariables {
  roastId: number;
  spiceLevel?: SpiceLevel;
}

/** Owner student: regenerate the roast (optionally with a new spice level). */
export function useRegenerateRoast(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roastId, spiceLevel }: RegenerateRoastVariables) =>
      roastService.regenerate(roastId, spiceLevel ? { spiceLevel } : {}),
    onSuccess: (roast: Roast) => {
      queryClient.setQueryData(reviewKeys.roast(submissionId), roast);
      void queryClient.invalidateQueries({ queryKey: ['roastWall'] });
    },
    onError: (err) => {
      // Our cached regenerateCount is stale — resync so the button disables itself.
      if (getErrorCode(err) === 'REGENERATE_LIMIT') {
        void queryClient.invalidateQueries({ queryKey: reviewKeys.roast(submissionId) });
      }
    },
  });
}

/** Instructor: hide/unhide the roast for the student and the wall. */
export function useSetRoastHidden(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roastId, isHidden }: { roastId: number; isHidden: boolean }) =>
      roastService.setHidden(roastId, isHidden),
    onSuccess: (roast: Roast) => {
      queryClient.setQueryData(reviewKeys.roast(submissionId), roast);
      void queryClient.invalidateQueries({ queryKey: ['roastWall'] });
    },
  });
}

/** Owner student: share/unshare on the course Roast Wall (creates a public slug on first share). */
export function useSetRoastShared(submissionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roastId, isShared }: { roastId: number; isShared: boolean }) =>
      roastService.setShared(roastId, isShared),
    onSuccess: (roast: Roast) => {
      queryClient.setQueryData(reviewKeys.roast(submissionId), roast);
      void queryClient.invalidateQueries({ queryKey: ['roastWall'] });
    },
  });
}
