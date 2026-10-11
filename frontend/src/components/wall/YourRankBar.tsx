import { Avatar, Flex, HStack, Text } from '@chakra-ui/react';

import { MotionBox } from '@/components/ui/motion';
import type { LeaderboardEntry } from '@/types';

export interface YourRankBarProps {
  entry: LeaderboardEntry;
}

/** Sticky "Your rank" summary shown while the user's row is below the fold. */
export function YourRankBar({ entry }: YourRankBarProps) {
  return (
    <MotionBox
      position="sticky"
      bottom={4}
      zIndex="sticky"
      mt={4}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
      role="status"
      aria-label={`Your rank: ${entry.rank}`}
    >
      <Flex
        align="center"
        justify="space-between"
        gap={3}
        px={4}
        py={3}
        borderRadius="2xl"
        bgGradient="linear(to-r, brand.500, maroon.500)"
        color="text.onBrand"
        boxShadow="xl"
      >
        <HStack spacing={3} minW={0}>
          <Avatar size="sm" name={entry.studentName} src={entry.avatarUrl ?? undefined} />
          <Text fontWeight={700} noOfLines={1}>
            Your rank: #{entry.rank}
          </Text>
        </HStack>
        <Text fontWeight={600} whiteSpace="nowrap">
          {entry.totalScore} pts · Keep going! 💪
        </Text>
      </Flex>
    </MotionBox>
  );
}

export default YourRankBar;
