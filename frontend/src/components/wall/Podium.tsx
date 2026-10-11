import { Avatar, Badge, Box, Flex, Text, VisuallyHidden } from '@chakra-ui/react';
import { useReducedMotion } from 'framer-motion';

import { MotionBox } from '@/components/ui/motion';
import type { LeaderboardEntry } from '@/types';

import { medalFor } from './wallUtils';

export interface PodiumProps {
  /** Top entries in rank order (at most 3 are shown). */
  entries: readonly LeaderboardEntry[];
  currentUserId?: number;
  tiedRanks: ReadonlySet<number>;
}

/** Visual order: 2nd · 1st · 3rd (DOM order stays 1 → 2 → 3 for screen readers). */
const VISUAL_ORDER = [2, 1, 3];

const PILLAR_HEIGHT: Record<number, { base: string; md: string }> = {
  1: { base: '110px', md: '150px' },
  2: { base: '82px', md: '112px' },
  3: { base: '62px', md: '84px' },
};

const PILLAR_GRADIENT: Record<number, string> = {
  1: 'linear(to-b, brand.400, maroon.500)',
  2: 'linear(to-b, brand.300, brand.600)',
  3: 'linear(to-b, jasmine.500, jigarthanda.400)',
};

/** Rise-in animation delay: 3rd, then 2nd, then 1st for a little drama. */
const RISE_DELAY: Record<number, number> = { 1: 0.45, 2: 0.25, 3: 0.1 };

function heightTier(rank: number): number {
  return Math.min(Math.max(rank, 1), 3);
}

export function Podium({ entries, currentUserId, tiedRanks }: PodiumProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const top = entries.slice(0, 3);

  return (
    <Flex
      as="ol"
      aria-label="Top 3"
      listStyleType="none"
      justify="center"
      align="flex-end"
      gap={{ base: 2, md: 4 }}
      w="full"
      maxW="2xl"
      mx="auto"
    >
      {top.map((entry, index) => {
        const tier = heightTier(entry.rank);
        const isMe = entry.studentId === currentUserId;
        const isTied = tiedRanks.has(entry.rank);
        const delay = RISE_DELAY[tier] ?? 0;
        return (
          <Flex
            as="li"
            key={entry.studentId}
            order={VISUAL_ORDER[index]}
            direction="column"
            align="center"
            flex="1"
            minW={0}
            maxW="200px"
            data-testid="podium-entry"
            data-current-user={isMe ? 'true' : undefined}
          >
            <MotionBox
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={1}
              mb={2}
              w="full"
              textAlign="center"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { delay: delay + 0.25, duration: 0.4, ease: 'easeOut' } }}
            >
              <Text fontSize={{ base: '2xl', md: '3xl' }} aria-hidden lineHeight={1}>
                {medalFor(entry.rank)}
              </Text>
              <VisuallyHidden>Rank {entry.rank}</VisuallyHidden>
              <Avatar
                size={tier === 1 ? 'lg' : 'md'}
                name={entry.studentName}
                src={entry.avatarUrl ?? undefined}
                borderWidth={isMe ? '3px' : '2px'}
                borderColor={isMe ? 'accent.primary' : 'border.subtle'}
              />
              <Text fontWeight={700} noOfLines={1} maxW="full" fontSize={{ base: 'sm', md: 'md' }}>
                {entry.studentName}
              </Text>
              <Text fontFamily="heading" fontWeight={800} color="text.accent" fontSize={{ base: 'md', md: 'lg' }}>
                {entry.totalScore} pts
              </Text>
              {isTied && (
                <Badge colorScheme="purple" variant="subtle" borderRadius="full" fontSize="2xs">
                  Tie
                </Badge>
              )}
              {isMe && (
                <Badge colorScheme="brand" variant="solid" borderRadius="full" fontSize="2xs">
                  Neenga dhaan! 👋
                </Badge>
              )}
            </MotionBox>
            <MotionBox
              w="full"
              h={PILLAR_HEIGHT[tier]}
              bgGradient={PILLAR_GRADIENT[tier]}
              borderTopRadius="xl"
              boxShadow={tier === 1 ? 'glow' : 'md'}
              transformOrigin="bottom"
              display="flex"
              alignItems="flex-start"
              justifyContent="center"
              pt={2}
              initial={reduceMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: 1, transition: { delay, duration: 0.6, ease: 'easeOut' } }}
              aria-hidden
            >
              <Box color="text.onBrand" fontFamily="heading" fontWeight={800} fontSize={{ base: 'xl', md: '3xl' }}>
                {entry.rank}
              </Box>
            </MotionBox>
          </Flex>
        );
      })}
    </Flex>
  );
}

export default Podium;
