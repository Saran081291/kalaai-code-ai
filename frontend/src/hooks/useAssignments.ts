import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assignmentService } from '@/services/assignmentService';
import type {
  Assignment,
  AssignmentCreateRequest,
  AssignmentUpdateRequest,
  RubricUpdateRequest,
} from '@/types';

/** Query keys for assignments (see PRPs/phase2-contracts.md §5). */
export const assignmentKeys = {
  detail: (id: number) => ['assignment', id] as const,
  forCourse: (courseId: number) => ['course', courseId, 'assignments'] as const,
};

function isValidId(id: number): boolean {
  return Number.isFinite(id) && id > 0;
}

/** Assignments of a course (students only receive published ones). */
export function useCourseAssignments(courseId: number, enabled = true) {
  return useQuery<Assignment[]>({
    queryKey: assignmentKeys.forCourse(courseId),
    queryFn: () => assignmentService.listForCourse(courseId),
    enabled: enabled && isValidId(courseId),
  });
}

/** Single assignment incl. `rubricCriteria` and (students) `myAttemptsCount`. */
export function useAssignment(id: number) {
  return useQuery<Assignment>({
    queryKey: assignmentKeys.detail(id),
    queryFn: () => assignmentService.get(id),
    enabled: isValidId(id),
  });
}

/** Store the fresh assignment and refresh its course list. */
function useCacheAssignment() {
  const queryClient = useQueryClient();
  return (assignment: Assignment) => {
    queryClient.setQueryData(assignmentKeys.detail(assignment.id), assignment);
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.forCourse(assignment.courseId) });
  };
}

export function useCreateAssignment(courseId: number) {
  const cacheAssignment = useCacheAssignment();
  return useMutation<Assignment, unknown, AssignmentCreateRequest>({
    mutationFn: (body) => assignmentService.create(courseId, body),
    onSuccess: cacheAssignment,
  });
}

export function useUpdateAssignment(id: number) {
  const cacheAssignment = useCacheAssignment();
  return useMutation<Assignment, unknown, AssignmentUpdateRequest>({
    mutationFn: (body) => assignmentService.update(id, body),
    onSuccess: cacheAssignment,
  });
}

export function useUpdateRubric(id: number) {
  const cacheAssignment = useCacheAssignment();
  return useMutation<Assignment, unknown, RubricUpdateRequest>({
    mutationFn: (body) => assignmentService.updateRubric(id, body),
    onSuccess: cacheAssignment,
  });
}

export function usePublishAssignment(id: number) {
  const cacheAssignment = useCacheAssignment();
  return useMutation<Assignment, unknown, void>({
    mutationFn: () => assignmentService.publish(id),
    onSuccess: cacheAssignment,
  });
}

export function useDeleteAssignment(id: number, courseId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => assignmentService.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: assignmentKeys.detail(id) });
      if (courseId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: assignmentKeys.forCourse(courseId) });
      }
    },
  });
}
