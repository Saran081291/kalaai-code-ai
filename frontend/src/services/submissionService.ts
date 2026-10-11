import { api } from '@/services/api';
import type {
  Page,
  PaginationParams,
  Submission,
  SubmissionCreateInput,
  SubmissionFile,
} from '@/types';

export const submissionService = {
  /**
   * POST multipart/form-data with fields `spiceLevel`, and either `githubUrl`
   * or one-or-more `files` (code files or a single .zip). Returns 202 + Submission.
   */
  async create(assignmentId: number, input: SubmissionCreateInput): Promise<Submission> {
    const form = new FormData();
    form.append('spiceLevel', input.spiceLevel);
    if (input.githubUrl !== undefined) {
      form.append('githubUrl', input.githubUrl);
    } else {
      input.files.forEach((file) => form.append('files', file, file.name));
    }
    const { data } = await api.post<Submission>(`/assignments/${assignmentId}/submissions`, form);
    return data;
  },

  /** Instructor: all submissions; student: own attempts. Denormalised fields populated. */
  async listForAssignment(
    assignmentId: number,
    params: PaginationParams = {},
  ): Promise<Page<Submission>> {
    const { data } = await api.get<Page<Submission>>(`/assignments/${assignmentId}/submissions`, {
      params,
    });
    return data;
  },

  /** The current student's submissions across courses (denormalised). */
  async mine(params: PaginationParams = {}): Promise<Page<Submission>> {
    const { data } = await api.get<Page<Submission>>('/submissions/me', { params });
    return data;
  },

  async get(id: number): Promise<Submission> {
    const { data } = await api.get<Submission>(`/submissions/${id}`);
    return data;
  },

  async files(id: number): Promise<SubmissionFile[]> {
    const { data } = await api.get<SubmissionFile[]>(`/submissions/${id}/files`);
    return data;
  },

  /** Only when status is `failed`; returns the submission (202). */
  async retry(id: number): Promise<Submission> {
    const { data } = await api.post<Submission>(`/submissions/${id}/retry`);
    return data;
  },
};
