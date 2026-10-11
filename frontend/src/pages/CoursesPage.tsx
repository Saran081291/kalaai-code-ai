import { Flex, Heading, SimpleGrid, Skeleton, SkeletonText, Text, VStack } from '@chakra-ui/react';
import { FiKey, FiPlus } from 'react-icons/fi';

import { CourseCard } from '@/components/courses/CourseCard';
import { QueryErrorState } from '@/components/courses/QueryErrorState';
import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useCourses, useIsInstructor } from '@/hooks/useCourses';
import { ROUTES } from '@/lib/routes';

const GRID_COLUMNS = { base: 1, md: 2, lg: 3 };

function CourseGridSkeleton() {
  return (
    <SimpleGrid columns={GRID_COLUMNS} spacing={5} aria-busy="true" aria-label="Loading courses">
      {[0, 1, 2].map((i) => (
        <GlassCard key={i} hoverable={false}>
          <Skeleton h="18px" w="80px" borderRadius="md" mb={4} />
          <Skeleton h="24px" w="70%" mb={4} />
          <SkeletonText noOfLines={3} spacing={2} />
        </GlassCard>
      ))}
    </SimpleGrid>
  );
}

export default function CoursesPage() {
  const isInstructor = useIsInstructor();
  const { data: courses, isLoading, isError, error, refetch } = useCourses();

  const headerAction = isInstructor ? (
    <GradientButton to={ROUTES.courseNew} leftIcon={<FiPlus />}>
      New course
    </GradientButton>
  ) : (
    <GradientButton to={ROUTES.courseJoin} leftIcon={<FiKey />}>
      Join course
    </GradientButton>
  );

  let content;
  if (isLoading) {
    content = <CourseGridSkeleton />;
  } else if (isError) {
    content = <QueryErrorState error={error} resource="course list" onRetry={() => void refetch()} backTo={ROUTES.dashboard} backLabel="Go to dashboard" />;
  } else if (!courses || courses.length === 0) {
    content = isInstructor ? (
      <EmptyState
        emoji="🏫"
        title="First course create pannunga, annae!"
        description="Create a course, share the join code, and let the roasting begin."
        action={
          <GradientButton to={ROUTES.courseNew} leftIcon={<FiPlus />}>
            New course
          </GradientButton>
        }
      />
    ) : (
      <EmptyState
        emoji="🎒"
        title="Innum course onnum illa! Join code vaangi join pannunga 🎒"
        description="Ask your instructor for the 8-character join code."
        action={
          <GradientButton to={ROUTES.courseJoin} leftIcon={<FiKey />}>
            Join course
          </GradientButton>
        }
      />
    );
  } else {
    content = (
      <AnimatedList columns={GRID_COLUMNS} spacing={5}>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </AnimatedList>
    );
  }

  return (
    <PageWrapper>
      <VStack align="stretch" spacing={8}>
        <Flex justify="space-between" align={{ base: 'flex-start', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={4}>
          <VStack align="flex-start" spacing={1}>
            <Heading size="xl">Courses</Heading>
            <Text color="text.muted">
              {isInstructor ? 'Courses you teach — ellam oru idathula.' : "Courses you're enrolled in — semma organised!"}
            </Text>
          </VStack>
          {headerAction}
        </Flex>
        {content}
      </VStack>
    </PageWrapper>
  );
}
