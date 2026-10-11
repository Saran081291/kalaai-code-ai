import {
  Badge,
  Box,
  HStack,
  Link,
  LinkBox,
  LinkOverlay,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { paths } from '@/lib/routes';
import type { Submission } from '@/types';

import { formatDateTime, formatRelativeTime } from './formatTime';
import { SourceIcon } from './SourceIcon';

export type SubmissionsTableVariant = 'instructor' | 'student';

export interface SubmissionsTableProps {
  submissions: Submission[];
  /** instructor → student name column; student → assignment title + course name. */
  variant: SubmissionsTableVariant;
}

function primaryLabel(submission: Submission, variant: SubmissionsTableVariant): string {
  if (variant === 'instructor') return submission.studentName ?? `Student #${submission.studentId}`;
  return submission.assignmentTitle ?? `Assignment #${submission.assignmentId}`;
}

function secondaryLabel(submission: Submission, variant: SubmissionsTableVariant): string | null {
  return variant === 'student' ? (submission.courseName ?? null) : null;
}

function scoreLabel(submission: Submission): string {
  const score = submission.effectiveScore;
  if (score === null || score === undefined) return '—';
  return submission.maxScore !== undefined ? `${score} / ${submission.maxScore}` : String(score);
}

function LateBadge() {
  return (
    <Badge colorScheme="red" variant="outline" borderRadius="full" fontSize="2xs" px={2}>
      Late
    </Badge>
  );
}

function SubmittedAt({ iso }: { iso: string }) {
  return (
    <Text as="time" dateTime={iso} title={formatDateTime(iso)} fontSize="sm" color="text.muted">
      {formatRelativeTime(iso)}
    </Text>
  );
}

/** Submissions list: a table on md+ screens, stacked cards on mobile. Each row links to the result page. */
export function SubmissionsTable({ submissions, variant }: SubmissionsTableProps) {
  const navigate = useNavigate();
  const firstColumn = variant === 'instructor' ? 'Student' : 'Assignment';

  return (
    <Box data-testid="submissions-table">
      {/* Desktop / tablet table */}
      <TableContainer
        display={{ base: 'none', md: 'block' }}
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="2xl"
        boxShadow="sm"
      >
        <Table variant="simple" size="md">
          <Thead>
            <Tr>
              <Th>{firstColumn}</Th>
              <Th isNumeric>Attempt</Th>
              <Th>Status</Th>
              <Th isNumeric>Score</Th>
              <Th>Submitted</Th>
              <Th>Source</Th>
            </Tr>
          </Thead>
          <Tbody>
            {submissions.map((submission) => {
              const to = paths.submissionResult(submission.id);
              const secondary = secondaryLabel(submission, variant);
              return (
                <Tr
                  key={submission.id}
                  cursor="pointer"
                  transition="background 0.15s ease"
                  _hover={{ bg: 'bg.subtle' }}
                  onClick={() => navigate(to)}
                  data-testid={`submission-row-${submission.id}`}
                >
                  <Td maxW="xs" whiteSpace="normal">
                    <Link
                      as={RouterLink}
                      to={to}
                      fontWeight={600}
                      color="text.primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {primaryLabel(submission, variant)}
                    </Link>
                    {secondary && (
                      <Text fontSize="sm" color="text.muted" noOfLines={1}>
                        {secondary}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>#{submission.attemptNumber}</Td>
                  <Td>
                    <StatusBadge status={submission.status} />
                  </Td>
                  <Td isNumeric fontWeight={600}>
                    {scoreLabel(submission)}
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <SubmittedAt iso={submission.submittedAt} />
                      {submission.isLate && <LateBadge />}
                    </HStack>
                  </Td>
                  <Td>
                    <SourceIcon sourceType={submission.sourceType} />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Mobile stacked cards */}
      <Box display={{ base: 'block', md: 'none' }}>
        <AnimatedList spacing={3}>
          {submissions.map((submission) => {
            const secondary = secondaryLabel(submission, variant);
            return (
              <LinkBox
                key={submission.id}
                as="article"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="xl"
                boxShadow="sm"
                p={4}
                transition="box-shadow 0.15s ease, transform 0.15s ease"
                _hover={{ boxShadow: 'md', transform: 'translateY(-2px)', borderColor: 'brand.300' }}
              >
                <Stack spacing={2}>
                  <HStack justify="space-between" align="start">
                    <Box minW={0}>
                      <LinkOverlay as={RouterLink} to={paths.submissionResult(submission.id)} fontWeight={600}>
                        {primaryLabel(submission, variant)}
                      </LinkOverlay>
                      {secondary && (
                        <Text fontSize="sm" color="text.muted" noOfLines={1}>
                          {secondary}
                        </Text>
                      )}
                    </Box>
                    <SourceIcon sourceType={submission.sourceType} />
                  </HStack>
                  <HStack spacing={2} flexWrap="wrap">
                    <StatusBadge status={submission.status} />
                    {submission.isLate && <LateBadge />}
                    <Text fontSize="sm" color="text.muted">
                      Attempt #{submission.attemptNumber}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <SubmittedAt iso={submission.submittedAt} />
                    <Text fontWeight={700}>{scoreLabel(submission)}</Text>
                  </HStack>
                </Stack>
              </LinkBox>
            );
          })}
        </AnimatedList>
      </Box>
    </Box>
  );
}

export default SubmissionsTable;
