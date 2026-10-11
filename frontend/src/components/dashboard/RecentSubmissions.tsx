import { chakra, Link, shouldForwardProp, Table, TableContainer, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { isValidMotionProp, motion, type Variants } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { paths } from '@/lib/routes';
import type { Submission } from '@/types';

import { formatAbsolute, formatRelativeIso } from './dashboardUtils';

export interface RecentSubmissionsProps {
  submissions: Submission[];
  now?: Date;
}

const forwardProps = (prop: string): boolean => isValidMotionProp(prop) || shouldForwardProp(prop);
const MotionTbody = chakra(motion.tbody, { shouldForwardProp: forwardProps });
const MotionTr = chakra(motion.tr, { shouldForwardProp: forwardProps });

const bodyVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

function scoreLabel(submission: Submission): string {
  if (typeof submission.effectiveScore !== 'number') return '—';
  return typeof submission.maxScore === 'number'
    ? `${submission.effectiveScore}/${submission.maxScore}`
    : String(submission.effectiveScore);
}

/** Latest submissions across the instructor's courses. Hides secondary columns on small screens. */
export function RecentSubmissions({ submissions, now = new Date() }: RecentSubmissionsProps) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        emoji="📭"
        title="Innum submissions varala"
        description="Once students submit code, the latest reviews will land here."
      />
    );
  }

  return (
    <GlassCard p={0} hoverable={false} overflow="hidden">
      <TableContainer>
        <Table size="sm" variant="simple" aria-label="Recent submissions">
          <Thead bg="bg.subtle">
            <Tr>
              <Th py={3}>Student</Th>
              <Th py={3}>Assignment</Th>
              <Th py={3} display={{ base: 'none', md: 'table-cell' }}>
                Course
              </Th>
              <Th py={3}>Status</Th>
              <Th py={3} isNumeric>
                Score
              </Th>
              <Th py={3} display={{ base: 'none', sm: 'table-cell' }}>
                Submitted
              </Th>
            </Tr>
          </Thead>
          <MotionTbody initial="hidden" animate="visible" variants={bodyVariants}>
            {submissions.map((submission) => (
              <MotionTr key={submission.id} variants={rowVariants} _hover={{ bg: 'bg.subtle' }} data-testid="recent-submission-row">
                <Td py={3} maxW="160px">
                  <Text noOfLines={1}>{submission.studentName ?? 'Unknown student'}</Text>
                </Td>
                <Td py={3} maxW="220px">
                  <Link
                    as={RouterLink}
                    to={paths.submissionResult(submission.id)}
                    fontWeight={600}
                    color="text.accent"
                    noOfLines={1}
                  >
                    {submission.assignmentTitle ?? `Submission #${submission.id}`}
                  </Link>
                </Td>
                <Td py={3} display={{ base: 'none', md: 'table-cell' }} maxW="180px">
                  <Text noOfLines={1} color="text.muted">
                    {submission.courseName ?? '—'}
                  </Text>
                </Td>
                <Td py={3}>
                  <StatusBadge status={submission.status} />
                </Td>
                <Td py={3} isNumeric fontWeight={600}>
                  {scoreLabel(submission)}
                </Td>
                <Td py={3} display={{ base: 'none', sm: 'table-cell' }}>
                  <Text
                    as="time"
                    dateTime={submission.submittedAt}
                    title={formatAbsolute(submission.submittedAt)}
                    color="text.muted"
                    fontSize="xs"
                  >
                    {formatRelativeIso(submission.submittedAt, now)}
                  </Text>
                </Td>
              </MotionTr>
            ))}
          </MotionTbody>
        </Table>
      </TableContainer>
    </GlassCard>
  );
}

export default RecentSubmissions;
