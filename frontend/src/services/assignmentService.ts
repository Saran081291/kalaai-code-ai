import { api } from '@/services/api';
import type {
  Assignment,
  AssignmentCreateRequest,
  AssignmentUpdateRequest,
  RubricUpdateRequest,
} from '@/types';

export const assignmentService = {
  /** Assignments of a course (students only receive published ones). Plain array. */
  async listForCourse(courseId: number): Promise<Assignment[]> {
    const { data } = await api.get<Assignment[]>(`/courses/${courseId}/assignments`);
    return data;
  },

  async create(courseId: number, body: AssignmentCreateRequest): Promise<Assignment> {
    const { data } = await api.post<Assignment>(`/courses/${courseId}/assignments`, body);
    return data;
  },

  /** Includes `rubricCriteria` and, for students, `myAttemptsCount`. */
  async get(id: number): Promise<Assignment> {
    const { data } = await api.get<Assignment>(`/assignments/${id}`);
    return data;
  },

  async update(id: number, body: AssignmentUpdateRequest): Promise<Assignment> {
    const { data } = await api.put<Assignment>(`/assignments/${id}`, body);
    return data;
  },

  /** 204; 409 if submissions exist. */
  async remove(id: number): Promise<void> {
    await api.delete(`/assignments/${id}`);
  },

  /** 400 RUBRIC_TOTAL_MISMATCH if rubric total ≠ maxScore. */
  async publish(id: number): Promise<Assignment> {
    const { data } = await api.post<Assignment>(`/assignments/${id}/publish`);
    return data;
  },

  /** Replaces all criteria; returns the assignment with `rubricCriteria`. */
  async updateRubric(id: number, body: RubricUpdateRequest): Promise<Assignment> {
    const { data } = await api.put<Assignment>(`/assignments/${id}/rubric`, body);
    return data;
  },
};
