import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { courseService } from '@/services/courseService';
import type { Course, CourseCreateRequest, CourseStudent, CourseUpdateRequest, UserRole } from '@/types';

/** Query keys for the courses module (see PRPs/phase2-contracts.md §5). */
export const courseKeys = {
  all: ['courses'] as const,
  detail: (id: number) => ['course', id] as const,
  students: (id: number) => ['course', id, 'students'] as const,
};

/** Instructors and admins get the "teacher" UI. */
export function isInstructorRole(role: UserRole | undefined | null): boolean {
  return role === 'instructor' || role === 'admin';
}

/** True when the signed-in user is an instructor or admin. */
export function useIsInstructor(): boolean {
  const { user } = useAuth();
  return isInstructorRole(user?.role);
}

/** Courses the user teaches or is enrolled in. */
export function useCourses() {
  return useQuery<Course[]>({
    queryKey: courseKeys.all,
    queryFn: () => courseService.list(),
  });
}

export function useCourse(id: number) {
  return useQuery<Course>({
    queryKey: courseKeys.detail(id),
    queryFn: () => courseService.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Enrolled students (course owner only). */
export function useCourseStudents(id: number, enabled = true) {
  return useQuery<CourseStudent[]>({
    queryKey: courseKeys.students(id),
    queryFn: () => courseService.students(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
  });
}

function useCacheCourse() {
  const queryClient = useQueryClient();
  return (course: Course) => {
    queryClient.setQueryData(courseKeys.detail(course.id), course);
    void queryClient.invalidateQueries({ queryKey: courseKeys.all });
  };
}

export function useCreateCourse() {
  const cacheCourse = useCacheCourse();
  return useMutation<Course, unknown, CourseCreateRequest>({
    mutationFn: (body) => courseService.create(body),
    onSuccess: cacheCourse,
  });
}

export function useJoinCourse() {
  const cacheCourse = useCacheCourse();
  return useMutation<Course, unknown, string>({
    mutationFn: (joinCode) => courseService.join(joinCode),
    onSuccess: cacheCourse,
  });
}

export function useUpdateCourse(id: number) {
  const cacheCourse = useCacheCourse();
  return useMutation<Course, unknown, CourseUpdateRequest>({
    mutationFn: (body) => courseService.update(id, body),
    onSuccess: cacheCourse,
  });
}

export function useRegenerateJoinCode(id: number) {
  const cacheCourse = useCacheCourse();
  return useMutation<Course, unknown, void>({
    mutationFn: () => courseService.regenerateCode(id),
    onSuccess: cacheCourse,
  });
}

export function useArchiveCourse(id: number) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => courseService.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseKeys.all });
      void queryClient.invalidateQueries({ queryKey: courseKeys.detail(id) });
    },
  });
}
