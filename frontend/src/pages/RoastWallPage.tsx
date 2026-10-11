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
import { useCallback, useMemo } from 'react';
import { FiArrowLeft, FiAward } from 'react-icons/fi';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { MotionBox } from '@/components/ui/motion';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { TextReveal } from '@/components/ui/TextReveal';
import { InfiniteLoader } from '@/components/wall/InfiniteLoader';
import { NotMemberState } from '@/components/wall/NotMemberState';
import { RoastCard } from '@/components/wall/RoastCard';
import { SortToggle } from '@/components/wall/SortToggle';
import { isNotCourseMemberError } from '@/components/wall/wallUtils';
import { useReactToRoast, useRoastWall, useWallCourse } from '@/hooks/useWall';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';
import type { RoastWallItem, RoastWallSort } from '@/types';

function parseSort(value: string | null): RoastWallSort {
  return value === 'top' ? 'top' : 'recent';
}

function WallSkeleton() {
  return (
    <Stack spacing={4} aria-hidden>
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} h="220px" borderRadius="2xl" startColor="bg.subtle" endColor="bg.muted" />
      ))}
    </Stack>
  );
}

export default function RoastWallPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = parseSort(searchParams.get('sort'));

  const course = useWallCourse(courseId);
  const wall = useRoastWall(courseId, sort);
  const react = useReactToRoast(courseId, sort);

  const items = useMemo<RoastWallItem[]>(
    () => wall.data?.pages.flatMap((page) => page.items) ?? [],
    [wall.data],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = wall;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSortChange = (next: RoastWallSort) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('sort', next);
        return params;
      },
      { replace: true },
    );
  };

  const validId = Number.isInteger(courseId) && courseId > 0;
  const notMember = isNotCourseMemberError(wall.error) || isNotCourseMemberError(course.error);

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
  } else if (wall.isPending) {
    body = <WallSkeleton />;
  } else if (wall.isError) {
    body = (
      <Alert status="error" borderRadius="xl" flexWrap="wrap" gap={2}>
        <AlertIcon />
        <AlertDescription flex="1">{getErrorMessage(wall.error)}</AlertDescription>
        <Button size="sm" variant="outline" colorScheme="red" onClick={() => void wall.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        emoji="🔥"
        title="Roast Wall kaali-ya irukku! Unga roast-a share pannunga 🔥"
        description="No roasts have been shared in this course yet. Share yours from your submission result page."
      />
    );
  } else {
    body = (
      <Box as="section" aria-label="Roasts" aria-busy={isFetchingNextPage}>
        {/* Keyed by sort so switching sorts replays the stagger; later pages just fade in. */}
        <AnimatedList key={sort} spacing={5}>
          {items.map((item) => (
            <RoastCard
              key={item.id}
              item={item}
              onReact={(reaction, active) => react.mutate({ roastId: item.id, reaction, active })}
            />
          ))}
        </AnimatedList>
        <InfiniteLoader hasMore={Boolean(hasNextPage)} isLoading={isFetchingNextPage} onLoadMore={loadMore} />
      </Box>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <PageWrapper maxW="3xl">
        <Stack spacing={6}>
          <Stack spacing={3}>
            <HStack spacing={4} flexWrap="wrap">
              {validId && (
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
              )}
            </HStack>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'flex-end' }} gap={4} flexWrap="wrap">
              <Box minW={0}>
                <TextReveal text="Roast Wall" size="xl" />
                {course.isPending && validId ? (
                  <Skeleton h="20px" w="180px" mt={1} />
                ) : (
                  course.data && (
                    <Text color="text.muted" fontWeight={600} noOfLines={1}>
                      {course.data.name} · Class mottham kalaai — react pannu 😂💀
                    </Text>
                  )
                )}
              </Box>
              {validId && !notMember && (
                <HStack spacing={3} flexWrap="wrap">
                  <SortToggle value={sort} onChange={handleSortChange} />
                  <MotionBox display="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    <Button
                      as={RouterLink}
                      to={paths.leaderboard(courseId)}
                      size="sm"
                      variant="ghost"
                      colorScheme="brand"
                      borderRadius="full"
                      leftIcon={<FiAward aria-hidden />}
                    >
                      Leaderboard
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
