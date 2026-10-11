import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { STATUS_META } from '@/lib/status';
import { assignmentService } from '@/services/assignmentService';
import { submissionService } from '@/services/submissionService';
import type { Assignment, Page, Submission, SubmissionCreateInput } from '@/types';

export const SUBMISSIONS_PAGE_SIZE = 20;
/** Poll interval while any listed submission is still in the pipeline. */
export const SUBMISSIONS_POLL_MS = 5000;

export const submissionKeys = {
  assignment: (assignmentId: number) => ['assignment', assignmentId] as const,
  assignmentSubmissions: (assignmentId: number, page: number) =>
    ['assignmentSubmissions', assignmentId, page] as const,
  assignmentSubmissionsAll: (assignmentId: number) => ['assignmentSubmissions', assignmentId] as const,
  mySubmissions: (page: number) => ['mySubmissions', page] as const,
  mySubmissionsAll: ['mySubmissions'] as const,
  submission: (id: number) => ['submission', id] as const,
};

/** True when any submission on the page is still pending/fetching/reviewing/roasting. */
export function hasInProgress(page: Page<Submission> | undefined): boolean {
  return page?.items.some((item) => STATUS_META[item.status].inProgress) ?? false;
}

/** Assignment info for submit / submissions pages (shares the `['assignment', id]` cache). */
export function useSubmissionAssignment(assignmentId: number): UseQueryResult<Assignment> {
  return useQuery({
    queryKey: submissionKeys.assignment(assignmentId),
    queryFn: () => assignmentService.get(assignmentId),
    enabled: Number.isFinite(assignmentId) && assignmentId > 0,
  });
}

/** Instructor: paginated submissions of an assignment; polls every 5s while any row is in progress. */
export function useAssignmentSubmissions(
  assignmentId: number,
  page: number,
  pageSize: number = SUBMISSIONS_PAGE_SIZE,
): UseQueryResult<Page<Submission>> {
  return useQuery({
    queryKey: submissionKeys.assignmentSubmissions(assignmentId, page),
    queryFn: () => submissionService.listForAssignment(assignmentId, { page, pageSize }),
    enabled: Number.isFinite(assignmentId) && assignmentId > 0,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (hasInProgress(query.state.data) ? SUBMISSIONS_POLL_MS : false),
  });
}

/** Student: own submissions across courses (paginated); polls while any row is in progress. */
export function useMySubmissions(
  page: number,
  pageSize: number = SUBMISSIONS_PAGE_SIZE,
): UseQueryResult<Page<Submission>> {
  return useQuery({
    queryKey: submissionKeys.mySubmissions(page),
    queryFn: () => submissionService.mine({ page, pageSize }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (hasInProgress(query.state.data) ? SUBMISSIONS_POLL_MS : false),
  });
}

/** Create a submission (multipart). Seeds the `['submission', id]` cache and invalidates lists. */
export function useCreateSubmission(
  assignmentId: number,
): UseMutationResult<Submission, Error, SubmissionCreateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmissionCreateInput) => submissionService.create(assignmentId, input),
    onSuccess: (submission) => {
      queryClient.setQueryData(submissionKeys.submission(submission.id), submission);
      void queryClient.invalidateQueries({ queryKey: submissionKeys.mySubmissionsAll });
      void queryClient.invalidateQueries({ queryKey: submissionKeys.assignmentSubmissionsAll(assignmentId) });
      void queryClient.invalidateQueries({ queryKey: submissionKeys.assignment(assignmentId) });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
