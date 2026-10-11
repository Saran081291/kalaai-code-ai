import { Box, Code, HStack, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import { MotionBox } from '@/components/ui/motion';
import { SpiceChip } from '@/components/ui/SpiceChip';
import type { SpiceLevel } from '@/types';

import { SpiceLevelSelector } from './SpiceLevelSelector';

interface SampleRoast {
  /** The (imaginary) code smell being roasted. */
  snippet: string;
  roast: string;
}

/** Demo roasts — always about the code, always ending with encouragement. */
const SAMPLE_ROASTS: Record<SpiceLevel, SampleRoast> = {
  mild: {
    snippet: 'data2 = data1\nfinalData = data2\nfinalData2 = finalData',
    roast:
      'Thambi, code nalla dhaan odudhu — aana data2, finalData, finalData2 nu peru vechirukka, idhu variable-aa illa Mattuthavani bus stand-la bus number-aa? 😄 Konjam meaningful name kudu, padikkuravanga santhosha paduvanga. Logic correct, structure neat — keep going, nee nalla varuva! 🌱',
  },
  medium: {
    snippet: 'try:\n    run_everything()\nexcept:\n    pass',
    roast:
      'Enna thambi, ore try/except-la full program-ae potu, error vandha "pass" nu silent-a anuppura? Meenakshi Amman kovil yaanai maari amaidhiya irukku, aana ulla bug ellam kumbal-a odudhu! 😏 Specific exception catch pannu, log pannu. Logic-la semma potential irukku — polish panna gethu dhaan! 💪',
  },
  mass: {
    snippet: 'def do_everything(x, xx, xxx):\n    # ...300 lines...',
    roast:
      'Enna thambi idhu? 300-line function-a? Idhu function illa ya, Chithirai thiruvizha crowd! 🔥 Nested if ellam bun parotta layer maari adukki vechirukka, test coverage Vaigai aaru maari — full-a dry! x, xx, xxx — variable-aa illa password-aa? Aana output correct-a varudhu, adhu gethu. Next time function-a chinna chinna-va odachi podu, Jigarthanda maari cool-a irukkum! 🌶️',
  },
};

/** Interactive landing demo: pick a spice level, see a sample Madurai roast. */
export function SpiceDemo() {
  const [level, setLevel] = useState<SpiceLevel>('medium');
  const sample = SAMPLE_ROASTS[level];

  return (
    <Stack spacing={5}>
      <SpiceLevelSelector
        value={level}
        onChange={setLevel}
        name="demoSpice"
        ariaLabel="Demo spice level"
      />
      <GlassCard hoverable={false} p={{ base: 5, md: 6 }}>
        <MotionBox
          key={level}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
        >
          <Stack spacing={4} aria-live="polite" data-testid="spice-demo-sample" data-spice={level}>
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Text fontSize="sm" fontWeight={600} color="text.muted">
                Sample code smell
              </Text>
              <SpiceChip level={level} size="sm" />
            </HStack>
            <Code
              display="block"
              whiteSpace="pre-wrap"
              p={3}
              borderRadius="lg"
              bg="bg.subtle"
              color="text.primary"
              fontSize="sm"
            >
              {sample.snippet}
            </Code>
            <Box borderLeftWidth="4px" borderColor="accent.primary" pl={4}>
              <Text fontSize={{ base: 'md', md: 'lg' }} whiteSpace="pre-wrap">
                {sample.roast}
              </Text>
            </Box>
          </Stack>
        </MotionBox>
      </GlassCard>
    </Stack>
  );
}

export default SpiceDemo;
