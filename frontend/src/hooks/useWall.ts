import { useToast } from '@chakra-ui/react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { getErrorMessage, getErrorStatus } from '@/services/api';
import { courseService } from '@/services/courseService';
import { roastService } from '@/services/roastService';
import type {
  Page,
  ReactionSummary,
  ReactionType,
  RoastWallItem,
  RoastWallSort,
} from '@/types';

export const WALL_PAGE_SIZE = 12;

/** Query keys (contract §5): ['roastWall', courseId, sort], ['leaderboard', courseId], ['course', id]. */
export const wallKeys = {
  courseWalls: (courseId: number) => ['roastWall', courseId] as const,
  wall: (courseId: number, sort: RoastWallSort) => ['roastWall', courseId, sort] as const,
  leaderboard: (courseId: number) => ['leaderboard', courseId] as const,
  course: (courseId: number) => ['course', courseId] as const,
  publicRoast: (slug: string) => ['publicRoast', slug] as const,
};

export type RoastWallCache = InfiniteData<Page<RoastWallItem>, number>;

/** Retry once for network/5xx errors, never for 4xx (403 NOT_COURSE_MEMBER, 404 …). */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

function isValidId(id: number): boolean {
  return Number.isInteger(id) && id > 0;
}

/** Course header data for the wall / leaderboard pages (shares the ['course', id] cache). */
export function useWallCourse(courseId: number) {
  return useQuery({
    queryKey: wallKeys.course(courseId),
    queryFn: () => courseService.get(courseId),
    enabled: isValidId(courseId),
    retry: retryUnlessClientError,
  });
}

/** Infinite, paginated roast wall feed. */
export function useRoastWall(courseId: number, sort: RoastWallSort) {
  return useInfiniteQuery({
    queryKey: wallKeys.wall(courseId, sort),
    queryFn: ({ pageParam }) =>
      roastService.wall(courseId, { sort, page: pageParam, pageSize: WALL_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: Page<RoastWallItem>): number | undefined => {
      if (lastPage.items.length === 0) return undefined;
      return lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: isValidId(courseId),
    retry: retryUnlessClientError,
  });
}

/**
 * Toggle a reaction locally. `active` = the user currently has this reaction (so it is removed);
 * otherwise it is added. Idempotent: adding an existing / removing a missing reaction is a no-op.
 */
export function toggleReaction(item: RoastWallItem, reaction: ReactionType, active: boolean): RoastWallItem {
  const has = item.myReactions.includes(reaction);
  const current = item.reactionCounts[reaction] ?? 0;
  if (active) {
    if (!has) return item;
    return {
      ...item,
      reactionCounts: { ...item.reactionCounts, [reaction]: Math.max(0, current - 1) },
      myReactions: item.myReactions.filter((r) => r !== reaction),
    };
  }
  if (has) return item;
  return {
    ...item,
    reactionCounts: { ...item.reactionCounts, [reaction]: current + 1 },
    myReactions: [...item.myReactions, reaction],
  };
}

/** Apply `update` to one roast in every cached wall page of the course (both sorts). */
function updateWallItem(
  queryClient: QueryClient,
  courseId: number,
  roastId: number,
  update: (item: RoastWallItem) => RoastWallItem,
): void {
  queryClient.setQueriesData<RoastWallCache>({ queryKey: wallKeys.courseWalls(courseId) }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === roastId ? update(item) : item)),
      })),
    };
  });
}

export interface ReactToRoastVariables {
  roastId: number;
  reaction: ReactionType;
  /** True when the user already has this reaction → it gets removed. */
  active: boolean;
}

function isReactVariables(value: unknown): value is ReactToRoastVariables {
  return typeof value === 'object' && value !== null && 'roastId' in value && 'reaction' in value;
}

/** Add / remove a reaction with an optimistic cache update and rollback on error. */
export function useReactToRoast(courseId: number, sort: RoastWallSort) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutationKey = ['reactToRoast', courseId] as const;

  return useMutation<ReactionSummary, unknown, ReactToRoastVariables>({
    mutationKey,
    // Serialise server calls so add/remove for the same roast never race each other.
    scope: { id: `roast-reactions-${courseId}` },
    mutationFn: ({ roastId, reaction, active }) =>
      active ? roastService.removeReaction(roastId, reaction) : roastService.addReaction(roastId, reaction),
    onMutate: async ({ roastId, reaction, active }) => {
      await queryClient.cancelQueries({ queryKey: wallKeys.courseWalls(courseId) });
      updateWallItem(queryClient, courseId, roastId, (item) => toggleReaction(item, reaction, active));
    },
    onError: (error, { roastId, reaction, active }) => {
      // Roll back by applying the inverse toggle (safe even with other reactions in flight).
      updateWallItem(queryClient, courseId, roastId, (item) => toggleReaction(item, reaction, !active));
      toast({
        status: 'error',
        title: "Reaction save aagala. Couldn't save your reaction.",
        description: getErrorMessage(error),
        isClosable: true,
      });
    },
    onSuccess: (summary, { roastId }) => {
      // Only trust the server snapshot when no newer reaction for this roast is still pending.
      const pendingForRoast = queryClient.isMutating({
        mutationKey,
        predicate: (mutation) =>
          isReactVariables(mutation.state.variables) && mutation.state.variables.roastId === roastId,
      });
      if (pendingForRoast > 1) return;
      updateWallItem(queryClient, courseId, roastId, (item) => ({
        ...item,
        reactionCounts: summary.reactionCounts,
        myReactions: summary.myReactions,
      }));
    },
    onSettled: () => {
      // Don't refetch the visible feed (it would reorder "top" under the user's finger);
      // just mark the other sort as stale so it refreshes next time it is opened.
      const otherSort: RoastWallSort = sort === 'top' ? 'recent' : 'top';
      void queryClient.invalidateQueries({ queryKey: wallKeys.wall(courseId, otherSort), refetchType: 'none' });
    },
  });
}

/** Course leaderboard (plain array ordered by rank; tied students share a rank). */
export function useLeaderboard(courseId: number) {
  return useQuery({
    queryKey: wallKeys.leaderboard(courseId),
    queryFn: () => roastService.leaderboard(courseId),
    enabled: isValidId(courseId),
    retry: retryUnlessClientError,
  });
}

/** Public shared roast by slug — no auth required. */
export function usePublicRoast(slug: string) {
  return useQuery({
    queryKey: wallKeys.publicRoast(slug),
    queryFn: () => roastService.getPublic(slug),
    enabled: slug.length > 0,
    retry: retryUnlessClientError,
  });
}
