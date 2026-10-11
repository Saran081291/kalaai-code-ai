import { Box, Flex, SimpleGrid, Text, useRadio, useRadioGroup, type UseRadioProps } from '@chakra-ui/react';

import { MotionBox } from '@/components/ui/motion';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { SPICE_META } from '@/lib/spice';
import { SPICE_LEVELS, type SpiceLevel } from '@/types';

export interface DefaultSpiceSelectorProps {
  value: SpiceLevel;
  onChange: (level: SpiceLevel) => void;
  isDisabled?: boolean;
  /** Accessible name of the radio group. */
  label?: string;
}

function isSpiceLevel(value: string): value is SpiceLevel {
  return (SPICE_LEVELS as readonly string[]).includes(value);
}

function SpiceOption({ level, ...radioProps }: UseRadioProps & { level: SpiceLevel }) {
  const { getInputProps, getRadioProps, state } = useRadio(radioProps);
  const meta = SPICE_META[level];

  return (
    <Box as="label" cursor={state.isDisabled ? 'not-allowed' : 'pointer'} h="full">
      <input {...getInputProps({ 'aria-label': `${meta.label}: ${meta.tagline}` })} />
      <MotionBox
        h="full"
        whileHover={state.isDisabled ? undefined : { y: -2 }}
        whileTap={state.isDisabled ? undefined : { scale: 0.98 }}
      >
        <Box
          {...getRadioProps()}
          h="full"
          p={4}
          borderWidth="2px"
          borderRadius="xl"
          borderColor="border.subtle"
          bg="bg.surface"
          opacity={state.isDisabled ? 0.6 : 1}
          transition="all 0.2s"
          _checked={{ borderColor: 'accent.primary', bg: 'bg.subtle', boxShadow: 'glow' }}
          _focusVisible={{ boxShadow: 'outline' }}
        >
          <Flex direction="column" gap={2} align="flex-start">
            <SpiceChip level={level} />
            <Text fontSize="sm" color="text.muted">
              {meta.tagline}
            </Text>
          </Flex>
        </Box>
      </MotionBox>
    </Box>
  );
}

/** Radio group of SpiceChips for the user's default roast spice level. */
export function DefaultSpiceSelector({
  value,
  onChange,
  isDisabled = false,
  label = 'Default spice level',
}: DefaultSpiceSelectorProps) {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'defaultSpiceLevel',
    value,
    isDisabled,
    onChange: (next) => {
      if (isSpiceLevel(next)) onChange(next);
    },
  });

  return (
    <SimpleGrid {...getRootProps()} role="radiogroup" aria-label={label} columns={{ base: 1, sm: 3 }} spacing={3}>
      {SPICE_LEVELS.map((level) => (
        <SpiceOption key={level} level={level} {...getRadioProps({ value: level })} />
      ))}
    </SimpleGrid>
  );
}

export default DefaultSpiceSelector;
