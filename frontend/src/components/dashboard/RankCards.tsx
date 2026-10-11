import { Flex, Heading, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { GlassCard } from '@/components/ui/GlassCard';
import { paths } from '@/lib/routes';
import type { CourseRank } from '@/types';

export interface RankCardsProps {
  ranks: CourseRank[];
}

function rankEmoji(rank: number | null): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🏆';
}

function RankCard({ rank }: { rank: CourseRank }) {
  const ranked = rank.rank !== null;
  return (
    <LinkBox as="article" h="full" data-testid="rank-card">
      <GlassCard p={5} h="full">
        <Flex direction="column" gap={2}>
          <LinkOverlay
            as={RouterLink}
            to={paths.leaderboard(rank.courseId)}
            fontWeight={700}
            color="text.primary"
            noOfLines={1}
            aria-label={`${rank.courseName} leaderboard`}
            _hover={{ color: 'text.accent' }}
          >
            {rank.courseName}
          </LinkOverlay>
          <Flex align="baseline" gap={2}>
            <Text fontSize="2xl" aria-hidden>
              {rankEmoji(rank.rank)}
            </Text>
            <Heading as="p" size="xl" fontFamily="heading" color={ranked ? 'text.accent' : 'text.muted'}>
              {ranked ? `#${rank.rank}` : '—'}
            </Heading>
            <Text fontSize="sm" color="text.muted">
              of {rank.totalStudents}
            </Text>
          </Flex>
          <Text fontSize="sm" color="text.muted">
            {ranked ? `${rank.totalScore} pts total` : 'Innum rank varala — first submit pannunga!'}
          </Text>
        </Flex>
      </GlassCard>
    </LinkBox>
  );
}

/** One leaderboard rank card per enrolled course. */
export function RankCards({ ranks }: RankCardsProps) {
  return (
    <AnimatedList columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
      {ranks.map((rank) => (
        <RankCard key={rank.courseId} rank={rank} />
      ))}
    </AnimatedList>
  );
}

export default RankCards;
