import { HStack, Text } from '@chakra-ui/react';
import { useReducedMotion } from 'framer-motion';

import { MotionSpan } from '@/components/ui/motion';
import { SPICE_META } from '@/lib/spice';
import type { SpiceLevel } from '@/types';

export interface SpiceMeterProps {
  level: SpiceLevel;
  /** Show the "Madurai Mass" label next to the chilies. */
  showLabel?: boolean;
}

const SLOTS = [1, 2, 3] as const;

/** 1–3 animated chilies (unfilled slots are greyed out). */
export function SpiceMeter({ level, showLabel = true }: SpiceMeterProps) {
  const reduceMotion = useReducedMotion();
  const meta = SPICE_META[level];

  return (
    <HStack spacing={2} role="img" aria-label={`Spice level: ${meta.label} (${meta.chilies} of 3 chilies)`}>
      <HStack spacing={0.5} aria-hidden>
        {SLOTS.map((slot) => {
          const filled = slot <= meta.chilies;
          return (
            <MotionSpan
              key={slot}
              display="inline-block"
              fontSize="2xl"
              opacity={filled ? 1 : 0.25}
              filter={filled ? undefined : 'grayscale(1)'}
              data-filled={filled ? 'true' : 'false'}
              initial={reduceMotion ? false : { scale: 0, rotate: -40 }}
              animate={{
                scale: 1,
                rotate: 0,
                transition: { type: 'spring', stiffness: 320, damping: 12, delay: reduceMotion ? 0 : 0.15 * slot },
              }}
            >
              🌶️
            </MotionSpan>
          );
        })}
      </HStack>
      {showLabel && (
        <Text fontWeight={700} color={meta.color} aria-hidden>
          {meta.label}
        </Text>
      )}
    </HStack>
  );
}

export default SpiceMeter;
