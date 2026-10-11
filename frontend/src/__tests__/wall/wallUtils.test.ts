import { describe, expect, it } from 'vitest';

import { findTiedRanks, formatRelativeTime, medalFor } from '@/components/wall/wallUtils';
import { toggleReaction } from '@/hooks/useWall';

import { makeEntry, makeWallItem } from './fixtures';

describe('toggleReaction', () => {
  it('adds and removes reactions idempotently', () => {
    const item = makeWallItem({ myReactions: [] });
    const added = toggleReaction(item, 'fire', false);
    expect(added.reactionCounts.fire).toBe(4);
    expect(added.myReactions).toEqual(['fire']);
    expect(toggleReaction(added, 'fire', false)).toBe(added);

    const removed = toggleReaction(added, 'fire', true);
    expect(removed.reactionCounts.fire).toBe(3);
    expect(removed.myReactions).toEqual([]);
    expect(toggleReaction(removed, 'fire', true)).toBe(removed);
  });

  it('never goes below zero', () => {
    const item = makeWallItem({ reactionCounts: { fire: 0, laugh: 0, skull: 0, clap: 0 }, myReactions: ['skull'] });
    expect(toggleReaction(item, 'skull', true).reactionCounts.skull).toBe(0);
  });
});

describe('leaderboard helpers', () => {
  it('finds tied ranks and medals', () => {
    const tied = findTiedRanks([makeEntry({ rank: 1 }), makeEntry({ rank: 2 }), makeEntry({ rank: 2 }), makeEntry({ rank: 4 })]);
    expect([...tied]).toEqual([2]);
    expect(medalFor(1)).toBe('🥇');
    expect(medalFor(7)).toBe('🏅');
  });
});

describe('formatRelativeTime', () => {
  it('formats past times', () => {
    const now = Date.parse('2026-10-10T12:00:00Z');
    expect(formatRelativeTime('2026-10-10T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-10-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('2026-10-09T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});
