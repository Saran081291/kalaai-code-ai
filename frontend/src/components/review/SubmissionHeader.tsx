import { Badge, Flex, HStack, Icon, Link, Skeleton, Stack, Text } from '@chakra-ui/react';
import { FiClock, FiExternalLink, FiGithub, FiUploadCloud, FiUser } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { GlassCard } from '@/components/ui/GlassCard';
import { SpiceChip } from '@/components/ui/SpiceChip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextReveal } from '@/components/ui/TextReveal';
import { paths } from '@/lib/routes';
import type { Assignment, Submission } from '@/types';

import { formatDateTime } from './reviewUtils';

export interface SubmissionHeaderProps {
  submission: Submission;
  assignment?: Assignment;
  isAssignmentLoading?: boolean;
  /** Show the student's name (instructor view). */
  showStudent?: boolean;
}

/** Assignment title, attempt #, spice, status, source and submitted time. */
export function SubmissionHeader({
  submission,
  assignment,
  isAssignmentLoading = false,
  showStudent = false,
}: SubmissionHeaderProps) {
  const title = assignment?.title ?? submission.assignmentTitle ?? `Assignment #${submission.assignmentId}`;

  return (
    <GlassCard hoverable={false} p={{ base: 4, md: 6 }} mb={6}>
      <Stack spacing={3}>
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={3}>
          <Stack spacing={1} minW={0}>
            <Text fontSize="sm" color="text.muted" fontWeight={600}>
              Review & Roast · Attempt #{submission.attemptNumber}
            </Text>
            <Skeleton isLoaded={!isAssignmentLoading} borderRadius="md">
              <TextReveal text={title} as="h1" size="lg" wordBreak="break-word" />
            </Skeleton>
            <Link
              as={RouterLink}
              to={paths.assignmentDetail(submission.assignmentId)}
              color="text.accent"
              fontSize="sm"
              w="fit-content"
            >
              View assignment
            </Link>
          </Stack>
          <HStack spacing={2} align="flex-start" flexWrap="wrap">
            <StatusBadge status={submission.status} size="sm" />
            <SpiceChip level={submission.spiceLevel} size="md" />
            {submission.isLate && (
              <Badge colorScheme="red" variant="solid" borderRadius="full" px={2}>
                Late
              </Badge>
            )}
          </HStack>
        </Flex>

        <Flex gap={{ base: 2, md: 6 }} direction={{ base: 'column', md: 'row' }} color="text.muted" fontSize="sm">
          {showStudent && submission.studentName && (
            <HStack spacing={1.5}>
              <Icon as={FiUser} aria-hidden />
              <Text>{submission.studentName}</Text>
            </HStack>
          )}
          {submission.sourceType === 'github' && submission.githubUrl ? (
            <HStack spacing={1.5} minW={0}>
              <Icon as={FiGithub} aria-hidden />
              <Link
                href={submission.githubUrl}
                isExternal
                rel="noopener noreferrer"
                color="text.accent"
                wordBreak="break-all"
              >
                {submission.githubUrl.replace(/^https?:\/\/(www\.)?/, '')}
                <Icon as={FiExternalLink} ml={1} aria-hidden />
              </Link>
              {submission.commitSha && (
                <Badge variant="outline" fontFamily="mono" title={submission.commitSha}>
                  {submission.commitSha.slice(0, 7)}
                </Badge>
              )}
            </HStack>
          ) : (
            <HStack spacing={1.5}>
              <Icon as={FiUploadCloud} aria-hidden />
              <Text>Uploaded files</Text>
            </HStack>
          )}
          <HStack spacing={1.5}>
            <Icon as={FiClock} aria-hidden />
            <Text>
              Submitted <time dateTime={submission.submittedAt}>{formatDateTime(submission.submittedAt)}</time>
            </Text>
          </HStack>
        </Flex>
      </Stack>
    </GlassCard>
  );
}

export default SubmissionHeader;
