import { Flex, SimpleGrid, Text } from '@chakra-ui/react';
import { useReducedMotion } from 'framer-motion';
import { useRef, type KeyboardEvent } from 'react';

import { MotionBox, MotionSpan } from '@/components/ui/motion';
import { SPICE_META } from '@/lib/spice';
import { SPICE_LEVELS, type SpiceLevel } from '@/types';

export interface SpiceSelectorProps {
  value: SpiceLevel;
  onChange: (level: SpiceLevel) => void;
  isDisabled?: boolean;
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];

/** Three big selectable chili cards (ARIA radiogroup with roving tabindex + arrow-key navigation). */
export function SpiceSelector({ value, onChange, isDisabled = false }: SpiceSelectorProps) {
  const reduceMotion = useReducedMotion();
  const refs = useRef<Partial<Record<SpiceLevel, HTMLDivElement | null>>>({});

  const select = (level: SpiceLevel, focus = false) => {
    if (isDisabled) return;
    onChange(level);
    if (focus) refs.current[level]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, level: SpiceLevel) => {
    const index = SPICE_LEVELS.indexOf(level);
    const count = SPICE_LEVELS.length;
    let target: SpiceLevel | undefined;
    if (NEXT_KEYS.includes(event.key)) target = SPICE_LEVELS[(index + 1) % count];
    else if (PREV_KEYS.includes(event.key)) target = SPICE_LEVELS[(index - 1 + count) % count];
    else if (event.key === 'Home') target = SPICE_LEVELS[0];
    else if (event.key === 'End') target = SPICE_LEVELS[count - 1];
    else if (event.key === ' ' || event.key === 'Enter') target = level;

    if (target) {
      event.preventDefault();
      select(target, target !== level);
    }
  };

  return (
    <SimpleGrid
      role="radiogroup"
      aria-label="Roast spice level"
      aria-disabled={isDisabled || undefined}
      columns={{ base: 1, sm: 3 }}
      spacing={4}
    >
      {SPICE_LEVELS.map((level) => {
        const meta = SPICE_META[level];
        const checked = value === level;
        const isMass = level === 'mass';
        return (
          <MotionBox
            key={level}
            ref={(node: HTMLDivElement | null) => {
              refs.current[level] = node;
            }}
            role="radio"
            aria-checked={checked}
            aria-label={`${meta.label}: ${meta.tagline}`}
            aria-disabled={isDisabled || undefined}
            tabIndex={checked && !isDisabled ? 0 : -1}
            data-spice={level}
            onClick={() => select(level)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => handleKeyDown(event, level)}
            whileHover={isDisabled ? undefined : { y: -6, scale: 1.03 }}
            whileTap={isDisabled ? undefined : { scale: 0.96 }}
            animate={{ scale: checked ? 1.02 : 1, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
            cursor={isDisabled ? 'not-allowed' : 'pointer'}
            opacity={isDisabled ? 0.6 : 1}
            borderWidth="2px"
            borderColor={checked ? meta.color : 'border.subtle'}
            bg={checked ? 'bg.subtle' : 'bg.surface'}
            boxShadow={checked ? 'lg' : 'sm'}
            borderRadius="2xl"
            p={5}
            textAlign="center"
            position="relative"
            _focusVisible={{ outline: 'none', boxShadow: 'outline' }}
          >
            <Flex direction="column" align="center" gap={2}>
              <Text fontSize="3xl" lineHeight={1.2} aria-hidden>
                {meta.emoji}
                {isMass && (
                  <MotionSpan
                    display="inline-block"
                    ml={1}
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            rotate: [0, -12, 12, -8, 8, 0],
                            scale: checked ? [1, 1.25, 1] : [1, 1.1, 1],
                            transition: { duration: 1.2, repeat: Infinity, repeatDelay: 0.6 },
                          }
                    }
                  >
                    🔥
                  </MotionSpan>
                )}
              </Text>
              <Text fontFamily="heading" fontWeight={800} fontSize="lg" color={checked ? meta.color : 'text.primary'}>
                {meta.label}
              </Text>
              <Text fontSize="sm" color="text.muted">
                {meta.tagline}
              </Text>
            </Flex>
          </MotionBox>
        );
      })}
    </SimpleGrid>
  );
}

export default SpiceSelector;
