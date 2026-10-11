import { Badge, Flex, Heading, HStack, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { paths } from '@/lib/routes';
import type { Assignment } from '@/types';

import { DueDateBadge } from './DueDateBadge';
import { LanguageBadge } from './LanguageBadge';

export interface AssignmentListProps {
  courseId: number;
  assignments: Assignment[];
  /** Instructor view: draft/published badges + "New assignment" CTA. */
  isInstructor: boolean;
}

function sortAssignments(list: Assignment[]): Assignment[] {
  // Soonest due first, then undated ones, newest created first.
  return [...list].sort((a, b) => {
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function AssignmentList({ courseId, assignments, isInstructor }: AssignmentListProps) {
  if (assignments.length === 0) {
    return isInstructor ? (
      <EmptyState
        emoji="📝"
        title="No assignments yet"
        description="Mudhal assignment podunga, annae — students waiting!"
        action={
          <GradientButton to={paths.assignmentNew(courseId)} leftIcon={<FiPlus />}>
            New assignment
          </GradientButton>
        }
      />
    ) : (
      <EmptyState
        emoji="😎"
        title="No assignments yet"
        description="Innum assignment varala. Relax pannunga, but not too much!"
      />
    );
  }

  return (
    <AnimatedList spacing={3}>
      {sortAssignments(assignments).map((a) => (
        <LinkBox as="article" key={a.id} aria-label={`Assignment: ${a.title}`}>
          <GlassCard p={{ base: 4, md: 5 }}>
            <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={3}>
              <Flex direction="column" gap={2} minW={0}>
                <HStack spacing={2} flexWrap="wrap">
                  <LanguageBadge language={a.language} />
                  {isInstructor && (
                    <Badge colorScheme={a.isPublished ? 'green' : 'gray'} variant={a.isPublished ? 'subtle' : 'outline'}>
                      {a.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                </HStack>
                <Heading size="sm" noOfLines={2}>
                  <LinkOverlay as={RouterLink} to={paths.assignmentDetail(a.id)}>
                    {a.title}
                  </LinkOverlay>
                </Heading>
                <DueDateBadge dueDate={a.dueDate} />
              </Flex>
              <Flex
                direction={{ base: 'row', md: 'column' }}
                align={{ base: 'center', md: 'flex-end' }}
                justify={{ base: 'space-between', md: 'center' }}
                gap={1}
                flexShrink={0}
              >
                <Text fontWeight={700}>{a.maxScore} pts</Text>
                {!isInstructor && (
                  <Text fontSize="sm" color="text.muted" aria-label="Attempts used">
                    {a.myAttemptsCount !== undefined
                      ? `${a.myAttemptsCount}/${a.maxAttempts} attempts`
                      : `${a.maxAttempts} ${a.maxAttempts === 1 ? 'attempt' : 'attempts'}`}
                  </Text>
                )}
              </Flex>
            </Flex>
          </GlassCard>
        </LinkBox>
      ))}
    </AnimatedList>
  );
}

export default AssignmentList;
