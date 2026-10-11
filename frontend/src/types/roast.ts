import type { ISODateString } from './common';
import type { ReactionType, SpiceLevel } from './enums';

export interface Roast {
  id: number;
  reviewId: number;
  spiceLevel: SpiceLevel;
  /** Plain text — render as text, never with dangerouslySetInnerHTML. */
  content: string;
  /** ≤ 140 chars */
  punchline: string;
  isHidden: boolean;
  isShared: boolean;
  shareSlug: string | null;
  regenerateCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Item of GET /courses/{id}/roast-wall. */
export interface RoastWallItem {
  id: number;
  punchline: string;
  content: string;
  spiceLevel: SpiceLevel;
  studentName: string;
  studentAvatarUrl?: string | null;
  assignmentTitle: string;
  effectiveScore?: number | null;
  maxScore?: number;
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
  createdAt: ISODateString;
}

export type RoastWallSort = 'recent' | 'top';

/** Row of GET /courses/{id}/leaderboard. */
export interface LeaderboardEntry {
  rank: number;
  studentId: number;
  studentName: string;
  avatarUrl: string | null;
  totalScore: number;
  assignmentsCompleted: number;
}

/** GET /public/roasts/{shareSlug} — no auth, no code, no email. */
export interface PublicRoast {
  punchline: string;
  spiceLevel: SpiceLevel;
  effectiveScore: number;
  maxScore: number;
  studentFirstName: string;
}

export interface RoastRegenerateRequest {
  spiceLevel?: SpiceLevel;
}

export interface RoastShareRequest {
  isShared: boolean;
}

export interface RoastVisibilityRequest {
  isHidden: boolean;
}

export interface ReactionRequest {
  reaction: ReactionType;
}

/** Response of POST /roasts/{id}/reactions and DELETE /roasts/{id}/reactions/{reaction}. */
export interface ReactionSummary {
  roastId: number;
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

/** Query for GET /courses/{id}/roast-wall. */
export interface RoastWallParams {
  sort?: RoastWallSort;
  page?: number;
  pageSize?: number;
}
