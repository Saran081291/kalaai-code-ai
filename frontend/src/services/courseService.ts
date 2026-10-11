import { api } from '@/services/api';
import type {
  Course,
  CourseCreateRequest,
  CourseStudent,
  CourseUpdateRequest,
} from '@/types';

export const courseService = {
  /** Courses the user teaches or is enrolled in (plain array, not paginated). */
  async list(): Promise<Course[]> {
    const { data } = await api.get<Course[]>('/courses');
    return data;
  },

  async get(id: number): Promise<Course> {
    const { data } = await api.get<Course>(`/courses/${id}`);
    return data;
  },

  async create(body: CourseCreateRequest): Promise<Course> {
    const { data } = await api.post<Course>('/courses', body);
    return data;
  },

  async update(id: number, body: CourseUpdateRequest): Promise<Course> {
    const { data } = await api.put<Course>(`/courses/${id}`, body);
    return data;
  },

  /** Archives the course (204). */
  async archive(id: number): Promise<void> {
    await api.delete(`/courses/${id}`);
  },

  async join(joinCode: string): Promise<Course> {
    const { data } = await api.post<Course>('/courses/join', { joinCode });
    return data;
  },

  async regenerateCode(id: number): Promise<Course> {
    const { data } = await api.post<Course>(`/courses/${id}/regenerate-code`);
    return data;
  },

  async students(id: number): Promise<CourseStudent[]> {
    const { data } = await api.get<CourseStudent[]>(`/courses/${id}/students`);
    return data;
  },
};
