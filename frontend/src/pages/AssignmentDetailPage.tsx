import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Link,
  Skeleton,
  SkeletonText,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiArrowLeft, FiEdit2, FiInbox } from 'react-icons/fi';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { DueDateBadge } from '@/components/assignments/DueDateBadge';
import { LanguageBadge } from '@/components/assignments/LanguageBadge';
import { PublishButton } from '@/components/assignments/PublishButton';
import { RubricTable } from '@/components/assignments/RubricTable';
import { SubmitPanel } from '@/components/assignments/SubmitPanel';
import { QueryErrorState } from '@/components/courses/QueryErrorState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAssignment } from '@/hooks/useAssignments';
import { useCourse, useIsInstructor } from '@/hooks/useCourses';
import { paths } from '@/lib/routes';

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const isInstructor = useIsInstructor();
  const query = useAssignment(assignmentId);
  const assignment = query.data;
  const courseQuery = useCourse(assignment?.courseId ?? 0);

  if (query.isLoading) {
    return (
      <PageWrapper>
        <VStack align="stretch" spacing={6} aria-busy="true" aria-label="Loading assignment">
          <Skeleton h="40px" w="60%" />
          <SkeletonText noOfLines={6} spacing={3} />
        </VStack>
      </PageWrapper>
    );
  }

  if (query.isError || !assignment) {
    return (
      <PageWrapper>
        <QueryErrorState
          error={query.error ?? new Error('Invalid assignment link.')}
          resource="assignment"
          onRetry={() => void query.refetch()}
        />
      </PageWrapper>
    );
  }

  const courseName = courseQuery.data?.name ?? 'Course';

  return (
    <PageWrapper>
      <VStack align="stretch" spacing={6}>
        <Link
          as={RouterLink}
          to={paths.courseDetail(assignment.courseId)}
          display="inline-flex"
          alignItems="center"
          gap={2}
          color="text.accent"
          fontWeight={600}
          alignSelf="flex-start"
        >
          <FiArrowLeft aria-hidden /> {courseName}
        </Link>

        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={4}>
          <VStack align="flex-start" spacing={3} minW={0}>
            <HStack spacing={2} flexWrap="wrap">
              <LanguageBadge language={assignment.language} />
              {isInstructor && !assignment.isPublished && (
                <Text as="span" fontSize="sm" color="text.muted">
                  Draft — students can't see this yet
                </Text>
              )}
            </HStack>
            <Heading size="xl" wordBreak="break-word">
              {assignment.title}
            </Heading>
            <DueDateBadge dueDate={assignment.dueDate} size="md" />
          </VStack>
          {isInstructor && (
            <HStack spacing={3} align="flex-start" flexWrap="wrap">
              <Button as={RouterLink} to={paths.assignmentEdit(assignment.id)} leftIcon={<FiEdit2 />} variant="outline">
                Edit
              </Button>
              <GradientButton to={paths.assignmentSubmissions(assignment.id)} leftIcon={<FiInbox />}>
                View submissions
              </GradientButton>
            </HStack>
          )}
        </Flex>

        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} alignItems="start">
          <GridItem minW={0}>
            <VStack align="stretch" spacing={6}>
              <GlassCard hoverable={false}>
                <Heading size="md" mb={3}>
                  Description
                </Heading>
                <Text whiteSpace="pre-wrap" wordBreak="break-word" lineHeight="tall">
                  {assignment.description}
                </Text>
              </GlassCard>
              <Box>
                <Heading size="md" mb={3}>
                  Rubric
                </Heading>
                <RubricTable criteria={assignment.rubricCriteria ?? []} maxScore={assignment.maxScore} />
              </Box>
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align="stretch" spacing={6}>
              <GlassCard hoverable={false}>
                <HStack spacing={6} justify="space-around">
                  <Stat textAlign="center">
                    <StatLabel color="text.muted">Max score</StatLabel>
                    <StatNumber>{assignment.maxScore}</StatNumber>
                  </Stat>
                  <Stat textAlign="center">
                    <StatLabel color="text.muted">Attempts</StatLabel>
                    <StatNumber>{assignment.maxAttempts}</StatNumber>
                  </Stat>
                  <Stat textAlign="center">
                    <StatLabel color="text.muted">Late</StatLabel>
                    <StatNumber fontSize="lg">{assignment.allowLate ? 'Allowed' : 'No'}</StatNumber>
                  </Stat>
                </HStack>
              </GlassCard>
              {isInstructor ? (
                <GlassCard hoverable={false}>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Publish state</Heading>
                    <Text fontSize="sm" color="text.muted">
                      {assignment.isPublished
                        ? 'Students can see and submit to this assignment.'
                        : 'Draft — only you can see it. Publish once the rubric adds up.'}
                    </Text>
                    <PublishButton assignment={assignment} />
                  </VStack>
                </GlassCard>
              ) : (
                <SubmitPanel assignment={assignment} />
              )}
            </VStack>
          </GridItem>
        </Grid>
      </VStack>
    </PageWrapper>
  );
}
