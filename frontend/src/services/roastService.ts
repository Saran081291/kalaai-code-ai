import { api } from '@/services/api';
import type {
  LeaderboardEntry,
  Page,
  PublicRoast,
  ReactionSummary,
  ReactionType,
  Roast,
  RoastRegenerateRequest,
  RoastWallItem,
  RoastWallParams,
} from '@/types';

export const roastService = {
  /** 404 ROAST_NOT_READY until generated; 404 for students when hidden. */
  async getForSubmission(submissionId: number): Promise<Roast> {
    const { data } = await api.get<Roast>(`/submissions/${submissionId}/roast`);
    return data;
  },

  /** Owner student; max 2 regenerations (409 REGENERATE_LIMIT). */
  async regenerate(roastId: number, body: RoastRegenerateRequest = {}): Promise<Roast> {
    const { data } = await api.post<Roast>(`/roasts/${roastId}/regenerate`, body);
    return data;
  },

  /** Instructor only. */
  async setHidden(roastId: number, isHidden: boolean): Promise<Roast> {
    const { data } = await api.put<Roast>(`/roasts/${roastId}/visibility`, { isHidden });
    return data;
  },

  /** Owner student. Generates `shareSlug` on first share. */
  async setShared(roastId: number, isShared: boolean): Promise<Roast> {
    const { data } = await api.put<Roast>(`/roasts/${roastId}/share`, { isShared });
    return data;
  },

  async addReaction(roastId: number, reaction: ReactionType): Promise<ReactionSummary> {
    const { data } = await api.post<ReactionSummary>(`/roasts/${roastId}/reactions`, {
      reaction,
    });
    return data;
  },

  async removeReaction(roastId: number, reaction: ReactionType): Promise<ReactionSummary> {
    const { data } = await api.delete<ReactionSummary>(`/roasts/${roastId}/reactions/${reaction}`);
    return data;
  },

  async wall(courseId: number, params: RoastWallParams = {}): Promise<Page<RoastWallItem>> {
    const { data } = await api.get<Page<RoastWallItem>>(`/courses/${courseId}/roast-wall`, {
      params,
    });
    return data;
  },

  /** Plain array, ordered by rank. */
  async leaderboard(courseId: number): Promise<LeaderboardEntry[]> {
    const { data } = await api.get<LeaderboardEntry[]>(`/courses/${courseId}/leaderboard`);
    return data;
  },

  /** Public, no auth required. */
  async getPublic(shareSlug: string): Promise<PublicRoast> {
    const { data } = await api.get<PublicRoast>(`/public/roasts/${shareSlug}`);
    return data;
  },
};
