import { Badge, Flex, LinkBox, LinkOverlay, SimpleGrid, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { GlassCard } from '@/components/ui/GlassCard';
import { paths } from '@/lib/routes';
import type { CourseStat } from '@/types';

export interface CourseStatsProps {
  stats: CourseStat[];
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Flex direction="column">
      <Text fontFamily="heading" fontWeight={800} fontSize="xl" color="text.primary">
        {value}
      </Text>
      <Text fontSize="xs" color="text.muted">
        {label}
      </Text>
    </Flex>
  );
}

function CourseStatCard({ stat }: { stat: CourseStat }) {
  return (
    <LinkBox as="article" h="full" data-testid="course-stat">
      <GlassCard p={5} h="full">
        <Flex align="center" justify="space-between" gap={2} mb={4}>
          <LinkOverlay
            as={RouterLink}
            to={paths.courseDetail(stat.courseId)}
            fontWeight={700}
            color="text.primary"
            noOfLines={1}
            _hover={{ color: 'text.accent' }}
          >
            {stat.courseName}
          </LinkOverlay>
          {stat.inProgressCount > 0 && (
            <Badge colorScheme="purple" variant="subtle" flexShrink={0}>
              {stat.inProgressCount} in progress
            </Badge>
          )}
        </Flex>
        <SimpleGrid columns={3} spacing={2}>
          <Metric label="Students" value={stat.studentCount} />
          <Metric label="Assignments" value={stat.assignmentCount} />
          <Metric label="Submissions" value={stat.submissionCount} />
        </SimpleGrid>
      </GlassCard>
    </LinkBox>
  );
}

/** Per-course counts for instructors; each card links to the course. */
export function CourseStats({ stats }: CourseStatsProps) {
  return (
    <AnimatedList columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
      {stats.map((stat) => (
        <CourseStatCard key={stat.courseId} stat={stat} />
      ))}
    </AnimatedList>
  );
}

export default CourseStats;
