import { Flex, HStack, LinkBox, LinkOverlay, Spinner, Text, VisuallyHidden } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { paths } from '@/lib/routes';
import { STATUS_META } from '@/lib/status';
import type { Submission } from '@/types';

import { formatAbsolute, formatRelativeIso } from './dashboardUtils';

export interface RecentResultsProps {
  results: Submission[];
  now?: Date;
}

function ResultScore({ submission }: { submission: Submission }) {
  const meta = STATUS_META[submission.status];
  if (meta.inProgress) {
    return (
      <Flex boxSize="72px" align="center" justify="center" flexShrink={0}>
        <Spinner color="accent.primary" thickness="3px" label="Review in progress" />
      </Flex>
    );
  }
  if (submission.status === 'completed' && typeof submission.maxScore === 'number') {
    return <ScoreRing score={submission.effectiveScore ?? null} max={submission.maxScore} size="72px" thickness="8px" />;
  }
  return (
    <Flex boxSize="72px" align="center" justify="center" flexShrink={0}>
      <Text fontSize="2xl" color="text.muted">
        <VisuallyHidden>No score</VisuallyHidden>
        <span aria-hidden="true">–</span>
      </Text>
    </Flex>
  );
}

function ResultItem({ submission, now }: { submission: Submission; now: Date }) {
  const meta = STATUS_META[submission.status];
  const title = submission.assignmentTitle ?? `Submission #${submission.id}`;

  return (
    <LinkBox as="article" data-testid="recent-result">
      <GlassCard p={4}>
        <Flex align="center" gap={4}>
          <ResultScore submission={submission} />
          <Flex direction="column" flex={1} minW={0} gap={1.5}>
            <LinkOverlay
              as={RouterLink}
              to={paths.submissionResult(submission.id)}
              fontWeight={700}
              color="text.primary"
              noOfLines={1}
              _hover={{ color: 'text.accent' }}
            >
              {title}
            </LinkOverlay>
            {submission.courseName && (
              <Text fontSize="sm" color="text.muted" noOfLines={1}>
                {submission.courseName}
              </Text>
            )}
            <HStack spacing={2} wrap="wrap">
              <StatusBadge status={submission.status} />
              <SpiceChip level={submission.spiceLevel} size="sm" />
              <Text as="time" dateTime={submission.submittedAt} title={formatAbsolute(submission.submittedAt)} fontSize="xs" color="text.muted">
                {formatRelativeIso(submission.submittedAt, now)}
              </Text>
            </HStack>
            {meta.inProgress && (
              <Text fontSize="xs" color="text.accent">
                {meta.funLine}
              </Text>
            )}
          </Flex>
        </Flex>
      </GlassCard>
    </LinkBox>
  );
}

/** Latest submissions with score ring / progress, status and spice. */
export function RecentResults({ results, now = new Date() }: RecentResultsProps) {
  if (results.length === 0) {
    return (
      <EmptyState
        emoji="🧑‍💻"
        title="Innum onnum submit pannala"
        description="Your reviewed submissions will show up here. First code-a anuppunga, roast ready-a irukku!"
      />
    );
  }

  return (
    <AnimatedList spacing={3}>
      {results.map((submission) => (
        <ResultItem key={submission.id} submission={submission} now={now} />
      ))}
    </AnimatedList>
  );
}

export default RecentResults;
