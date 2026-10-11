import { SimpleGrid, Text, VStack, useRadioGroup } from '@chakra-ui/react';

import { SpiceChip } from '@/components/ui/SpiceChip';
import { SPICE_META } from '@/lib/spice';
import { SPICE_LEVELS, type SpiceLevel } from '@/types';

import { RadioCard } from './RadioCard';

function isSpiceLevel(value: string): value is SpiceLevel {
  return (SPICE_LEVELS as readonly string[]).includes(value);
}

export interface SpiceLevelSelectorProps {
  value: SpiceLevel;
  onChange: (level: SpiceLevel) => void;
  /** Radio group name (must be unique per page). */
  name?: string;
  /** Accessible name of the group. */
  ariaLabel?: string;
  /** Show the Tanglish tagline under each chip. */
  showTagline?: boolean;
  isDisabled?: boolean;
}

/** Mild / Medium / Madurai Mass picker built from SpiceChips (keyboard-accessible radio group). */
export function SpiceLevelSelector({
  value,
  onChange,
  name = 'spiceLevel',
  ariaLabel = 'Spice level',
  showTagline = true,
  isDisabled = false,
}: SpiceLevelSelectorProps) {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name,
    value,
    isDisabled,
    onChange: (next) => {
      if (isSpiceLevel(next)) onChange(next);
    },
  });

  return (
    <SimpleGrid {...getRootProps()} role="radiogroup" aria-label={ariaLabel} columns={{ base: 1, sm: 3 }} spacing={3}>
      {SPICE_LEVELS.map((level) => (
        <RadioCard
          key={level}
          label={SPICE_META[level].label}
          description={SPICE_META[level].tagline}
          {...getRadioProps({ value: level })}
        >
          <VStack spacing={1} align={{ base: 'flex-start', sm: 'center' }} textAlign={{ base: 'left', sm: 'center' }}>
            <SpiceChip level={level} />
            {showTagline && (
              <Text fontSize="xs" color="text.muted">
                {SPICE_META[level].tagline}
              </Text>
            )}
          </VStack>
        </RadioCard>
      ))}
    </SimpleGrid>
  );
}

export default SpiceLevelSelector;
