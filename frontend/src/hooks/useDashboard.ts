import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { STATUS_META } from '@/lib/status';
import { dashboardService } from '@/services/dashboardService';
import type { DashboardResponse, Submission } from '@/types';

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

/** Poll every 10s while any listed submission is still in the pipeline. */
export const DASHBOARD_POLL_INTERVAL_MS = 10_000;

function listedSubmissions(data: DashboardResponse): Submission[] {
  return data.role === 'student' ? data.recentResults : [...data.recentSubmissions, ...data.failedSubmissions];
}

/** True when a submission shown on the dashboard is pending/fetching/reviewing/roasting. */
export function hasInProgressSubmissions(data: DashboardResponse | undefined): boolean {
  if (!data) return false;
  return listedSubmissions(data).some((submission) => STATUS_META[submission.status].inProgress);
}

/** GET /dashboard — role-based summary (discriminate on `data.role`). */
export function useDashboard(): UseQueryResult<DashboardResponse> {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardService.get(),
    refetchInterval: (query) => (hasInProgressSubmissions(query.state.data) ? DASHBOARD_POLL_INTERVAL_MS : false),
  });
}
