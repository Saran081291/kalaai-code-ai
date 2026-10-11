import { Button, HStack } from '@chakra-ui/react';

import { MotionBox, MotionSpan } from '@/components/ui/motion';
import { REACTION_TYPES, type ReactionType } from '@/types';

import { REACTION_META } from './wallUtils';

export interface ReactionBarProps {
  counts: Record<ReactionType, number>;
  myReactions: readonly ReactionType[];
  /** `active` = the user already reacted with this emoji (clicking removes it). */
  onToggle: (reaction: ReactionType, active: boolean) => void;
}

/** 🔥 😂 💀 👏 toggle buttons with counts. */
export function ReactionBar({ counts, myReactions, onToggle }: ReactionBarProps) {
  return (
    <HStack role="group" aria-label="Reactions" spacing={2} flexWrap="wrap">
      {REACTION_TYPES.map((reaction) => {
        const meta = REACTION_META[reaction];
        const active = myReactions.includes(reaction);
        const count = counts[reaction] ?? 0;
        return (
          <MotionBox key={reaction} display="inline-block" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}>
            <Button
              size="sm"
              borderRadius="full"
              variant={active ? 'solid' : 'outline'}
              colorScheme={active ? 'brand' : 'gray'}
              borderColor={active ? undefined : 'border.subtle'}
              aria-pressed={active}
              aria-label={`React ${meta.label} (${count})`}
              title={active ? `Remove ${meta.label} reaction` : `React with ${meta.label}`}
              onClick={() => onToggle(reaction, active)}
              leftIcon={<span aria-hidden>{meta.emoji}</span>}
              iconSpacing={1.5}
            >
              <MotionSpan
                key={count}
                display="inline-block"
                initial={{ scale: 1.35 }}
                animate={{ scale: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
              >
                {count}
              </MotionSpan>
            </Button>
          </MotionBox>
        );
      })}
    </HStack>
  );
}

export default ReactionBar;
