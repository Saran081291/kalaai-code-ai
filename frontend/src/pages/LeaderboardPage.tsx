import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Flex,
  HStack,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react';
import { MotionConfig } from 'framer-motion';
import { useMemo, useState } from 'react';
import { FiArrowLeft, FiMessageCircle } from 'react-icons/fi';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { MotionBox } from '@/components/ui/motion';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { TextReveal } from '@/components/ui/TextReveal';
import { LeaderboardTable } from '@/components/wall/LeaderboardTable';
import { NotMemberState } from '@/components/wall/NotMemberState';
import { Podium } from '@/components/wall/Podium';
import { findTiedRanks, isNotCourseMemberError } from '@/components/wall/wallUtils';
import { YourRankBar } from '@/components/wall/YourRankBar';
import { useAuth } from '@/hooks/useAuth';
import { useLeaderboard, useWallCourse } from '@/hooks/useWall';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';
import type { LeaderboardEntry } from '@/types';

const PODIUM_SIZE = 3;

function hasAnyScore(entries: readonly LeaderboardEntry[]): boolean {
  return entries.some((entry) => entry.totalScore > 0 || entry.assignmentsCompleted > 0);
}

export default function LeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const { user } = useAuth();
  const course = useWallCourse(courseId);
  const leaderboard = useLeaderboard(courseId);
  const [myRowVisible, setMyRowVisible] = useState(true);

  const entries = useMemo<LeaderboardEntry[]>(() => leaderboard.data ?? [], [leaderboard.data]);
  const tiedRanks = useMemo(() => findTiedRanks(entries), [entries]);
  const podium = entries.slice(0, PODIUM_SIZE);
  const rest = entries.slice(PODIUM_SIZE);
  const myEntry = user ? entries.find((entry) => entry.studentId === user.id) : undefined;
  const meInTable = myEntry !== undefined && rest.includes(myEntry);
  const notMember = isNotCourseMemberError(leaderboard.error) || isNotCourseMemberError(course.error);

  let body;
  if (!validId) {
    body = (
      <EmptyState
        emoji="🤷"
        title="Indha course-a kaanom!"
        description="This course link doesn't look right."
        action={
          <Button as={RouterLink} to={ROUTES.courses} colorScheme="brand" borderRadius="full">
            Go to my courses
          </Button>
        }
      />
    );
  } else if (notMember) {
    body = <NotMemberState />;
  } else if (leaderboard.isPending) {
    body = (
      <Stack spacing={4} aria-hidden>
        <Skeleton h="240px" borderRadius="2xl" startColor="bg.subtle" endColor="bg.muted" />
        <Skeleton h="200px" borderRadius="2xl" startColor="bg.subtle" endColor="bg.muted" />
      </Stack>
    );
  } else if (leaderboard.isError) {
    body = (
      <Alert status="error" borderRadius="xl" flexWrap="wrap" gap={2}>
        <AlertIcon />
        <AlertDescription flex="1">{getErrorMessage(leaderboard.error)}</AlertDescription>
        <Button size="sm" variant="outline" colorScheme="red" onClick={() => void leaderboard.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  } else if (!hasAnyScore(entries)) {
    body = (
      <EmptyState
        emoji="🏁"
        title="Innum score-e illa, first submit pannunga!"
        description="Nobody has a reviewed submission in this course yet. Scores show up here once reviews are done."
      />
    );
  } else {
    body = (
      <Stack spacing={8}>
        <Podium entries={podium} currentUserId={user?.id} tiedRanks={tiedRanks} />
        {rest.length > 0 && (
          <LeaderboardTable
            entries={rest}
            currentUserId={user?.id}
            tiedRanks={tiedRanks}
            onCurrentUserVisibilityChange={setMyRowVisible}
          />
        )}
        {meInTable && myEntry && !myRowVisible && <YourRankBar entry={myEntry} />}
      </Stack>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <PageWrapper maxW="4xl">
        <Stack spacing={8}>
          <Stack spacing={3}>
            {validId && (
              <Box>
                <MotionBox display="inline-block" whileHover={{ x: -2 }} whileTap={{ scale: 0.96 }}>
                  <Button
                    as={RouterLink}
                    to={paths.courseDetail(courseId)}
                    variant="link"
                    colorScheme="brand"
                    size="sm"
                    leftIcon={<FiArrowLeft aria-hidden />}
                  >
                    Back to course
                  </Button>
                </MotionBox>
              </Box>
            )}
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'flex-end' }} gap={4} flexWrap="wrap">
              <Box minW={0}>
                <TextReveal text="Leaderboard" size="xl" />
                {course.isPending && validId ? (
                  <Skeleton h="20px" w="180px" mt={1} />
                ) : (
                  course.data && (
                    <Text color="text.muted" fontWeight={600} noOfLines={1}>
                      {course.data.name} · Yaaru gethu-nu inga theriyum 🏆
                    </Text>
                  )
                )}
              </Box>
              {validId && !notMember && (
                <HStack>
                  <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    <Button
                      as={RouterLink}
                      to={paths.roastWall(courseId)}
                      size="sm"
                      variant="ghost"
                      colorScheme="brand"
                      borderRadius="full"
                      leftIcon={<FiMessageCircle aria-hidden />}
                    >
                      Roast Wall
                    </Button>
                  </MotionBox>
                </HStack>
              )}
            </Flex>
          </Stack>
          {body}
        </Stack>
      </PageWrapper>
    </MotionConfig>
  );
}
