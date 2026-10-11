import { Badge, Box, HStack, Icon, Text, Tooltip, useToast, VStack } from '@chakra-ui/react';
import { FiCheckCircle, FiSend } from 'react-icons/fi';

import { GradientButton } from '@/components/ui/GradientButton';
import { usePublishAssignment } from '@/hooks/useAssignments';
import type { Assignment } from '@/types';

import { assignmentErrorMessage } from './errors';
import { publishBlockReason } from './rules';

export interface PublishButtonProps {
  assignment: Assignment;
  /** Unsaved rubric edits on the page — publish uses the saved rubric. */
  hasUnsavedChanges?: boolean;
}

/** Publish an assignment (one-way). Disabled with an explanation until the saved rubric is valid. */
export function PublishButton({ assignment, hasUnsavedChanges = false }: PublishButtonProps) {
  const toast = useToast();
  const publish = usePublishAssignment(assignment.id);

  if (assignment.isPublished) {
    return (
      <Badge colorScheme="green" variant="subtle" px={3} py={1} borderRadius="full" display="inline-flex" gap={1.5} alignItems="center">
        <Icon as={FiCheckCircle} aria-hidden /> Published
      </Badge>
    );
  }

  const reason = publishBlockReason(assignment, hasUnsavedChanges);

  const handlePublish = () => {
    publish.mutate(undefined, {
      onSuccess: () => toast({ status: 'success', title: 'Published! Students ippo paaka mudiyum 🚀' }),
      onError: (err) =>
        toast({ status: 'error', title: "Couldn't publish the assignment", description: assignmentErrorMessage(err) }),
    });
  };

  return (
    <VStack align={{ base: 'stretch', md: 'flex-end' }} spacing={1}>
      <HStack>
        <Tooltip label={reason ?? 'Make this assignment visible to students'} hasArrow>
          {/* Wrapper keeps the tooltip working while the button is disabled. */}
          <Box as="span" tabIndex={reason ? 0 : undefined} display="inline-block">
            <GradientButton
              leftIcon={<FiSend />}
              onClick={handlePublish}
              isDisabled={reason !== null}
              isLoading={publish.isPending}
            >
              Publish
            </GradientButton>
          </Box>
        </Tooltip>
      </HStack>
      {reason && (
        <Text fontSize="xs" color="text.muted" data-testid="publish-block-reason">
          {reason}
        </Text>
      )}
    </VStack>
  );
}

export default PublishButton;
