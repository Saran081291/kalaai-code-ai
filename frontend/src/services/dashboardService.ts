import { api } from '@/services/api';
import type { DashboardResponse } from '@/types';

export const dashboardService = {
  /** Role-based summary; discriminate on `role`. */
  async get(): Promise<DashboardResponse> {
    const { data } = await api.get<DashboardResponse>('/dashboard');
    return data;
  },
};
