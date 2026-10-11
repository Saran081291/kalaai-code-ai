import { Badge, Flex, Heading, HStack, Icon, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { FiUsers } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { GlassCard } from '@/components/ui/GlassCard';
import { paths } from '@/lib/routes';
import type { Course } from '@/types';

export interface CourseCardProps {
  course: Course;
}

/** Grid card for /courses — whole card links to the course detail page. */
export function CourseCard({ course }: CourseCardProps) {
  const studentCount = course.studentCount ?? 0;

  return (
    <LinkBox as="article" h="full" aria-label={`Course: ${course.name}`}>
      <GlassCard h="full" display="flex" flexDirection="column" gap={3} opacity={course.isArchived ? 0.75 : 1}>
        <HStack spacing={2} flexWrap="wrap">
          <Badge colorScheme={course.isInstructor ? 'purple' : 'green'} variant="subtle">
            {course.isInstructor ? 'Teaching' : 'Enrolled'}
          </Badge>
          {course.isArchived && (
            <Badge colorScheme="gray" variant="outline">
              Archived
            </Badge>
          )}
        </HStack>
        <Heading size="md" noOfLines={2}>
          <LinkOverlay as={RouterLink} to={paths.courseDetail(course.id)}>
            {course.name}
          </LinkOverlay>
        </Heading>
        <Text color="text.muted" fontSize="sm" noOfLines={3} flex="1">
          {course.description?.trim() ? course.description : 'No description yet.'}
        </Text>
        <Flex align="center" gap={2} color="text.muted" fontSize="sm">
          <Icon as={FiUsers} aria-hidden />
          <Text>
            {studentCount} {studentCount === 1 ? 'student' : 'students'}
          </Text>
        </Flex>
      </GlassCard>
    </LinkBox>
  );
}

export default CourseCard;
