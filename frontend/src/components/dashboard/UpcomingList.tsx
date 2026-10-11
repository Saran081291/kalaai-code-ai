import { Badge, Flex, HStack, Link, Text, Tooltip } from '@chakra-ui/react';
import { FiClock, FiRepeat } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { paths } from '@/lib/routes';
import type { UpcomingAssignment } from '@/types';

import { formatAbsolute, getDueInfo } from './dashboardUtils';

export interface UpcomingListProps {
  items: UpcomingAssignment[];
  /** Injected for deterministic tests; defaults to now. */
  now?: Date;
}

interface UpcomingItemProps {
  item: UpcomingAssignment;
  now: Date;
}

function UpcomingItem({ item, now }: UpcomingItemProps) {
  const due = getDueInfo(item.dueDate, now);
  const attemptsLeft = item.maxAttempts - item.attemptsUsed;
  const exhausted = attemptsLeft <= 0;

  return (
    <GlassCard p={4} data-testid="upcoming-item">
      <Flex direction={{ base: 'column', sm: 'row' }} align={{ base: 'stretch', sm: 'center' }} gap={4}>
        <Flex direction="column" flex={1} minW={0} gap={1.5}>
          <Link
            as={RouterLink}
            to={paths.assignmentDetail(item.id)}
            fontWeight={700}
            fontSize="md"
            color="text.primary"
            noOfLines={1}
            _hover={{ color: 'text.accent', textDecoration: 'underline' }}
          >
            {item.title}
          </Link>
          <Text fontSize="sm" color="text.muted" noOfLines={1}>
            {item.courseName}
          </Text>
          <HStack spacing={2} wrap="wrap">
            <Tooltip label={item.dueDate ? formatAbsolute(item.dueDate) : undefined} isDisabled={!item.dueDate} hasArrow>
              <Badge
                colorScheme={due.colorScheme}
                variant="subtle"
                display="inline-flex"
                alignItems="center"
                gap={1}
                data-urgency={due.urgency}
              >
                <FiClock aria-hidden />
                {due.label}
              </Badge>
            </Tooltip>
            <Badge
              colorScheme={exhausted ? 'red' : 'gray'}
              variant="outline"
              display="inline-flex"
              alignItems="center"
              gap={1}
              aria-label={`Attempts used: ${item.attemptsUsed} of ${item.maxAttempts}`}
            >
              <FiRepeat aria-hidden />
              {item.attemptsUsed}/{item.maxAttempts}
            </Badge>
          </HStack>
        </Flex>
        <GradientButton
          to={exhausted ? undefined : paths.submit(item.id)}
          size="sm"
          isDisabled={exhausted}
          aria-label={exhausted ? `No attempts left for ${item.title}` : `Submit ${item.title}`}
        >
          {exhausted ? 'No attempts left' : 'Submit'}
        </GradientButton>
      </Flex>
    </GlassCard>
  );
}

/** Next assignments due for the student, with urgency-colored due dates and a Submit CTA. */
export function UpcomingList({ items, now = new Date() }: UpcomingListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        emoji="🎉"
        title="Ellam submit panniyaachu! Semma 🎉"
        description="No pending assignments right now. Relax pannunga, thambi."
      />
    );
  }

  return (
    <AnimatedList spacing={3}>
      {items.map((item) => (
        <UpcomingItem key={item.id} item={item} now={now} />
      ))}
    </AnimatedList>
  );
}

export default UpcomingList;
