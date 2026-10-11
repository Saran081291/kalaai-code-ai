import { api } from '@/services/api';
import type { Review, ReviewOverrideRequest, Submission } from '@/types';

export const reviewService = {
  /** 404 REVIEW_NOT_READY until the review step completes. */
  async getForSubmission(submissionId: number): Promise<Review> {
    const { data } = await api.get<Review>(`/submissions/${submissionId}/review`);
    return data;
  },

  /** Instructor only. `overrideScore: null` clears the override. */
  async override(reviewId: number, body: ReviewOverrideRequest): Promise<Review> {
    const { data } = await api.put<Review>(`/reviews/${reviewId}/override`, body);
    return data;
  },

  /** Instructor only: discards review + roast and re-runs the AI (202). */
  async reReview(submissionId: number): Promise<Submission> {
    const { data } = await api.post<Submission>(`/submissions/${submissionId}/re-review`);
    return data;
  },
};
