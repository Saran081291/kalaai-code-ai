import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Flex,
  Heading,
  HStack,
  Skeleton,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { FiArrowLeft, FiEye, FiSave } from 'react-icons/fi';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { DeleteAssignmentButton } from '@/components/assignments/DeleteAssignmentButton';
import { assignmentErrorMessage } from '@/components/assignments/errors';
import { PublishButton } from '@/components/assignments/PublishButton';
import {
  criteriaToDrafts,
  draftsToInput,
  rubricTotal,
  validateCriteria,
  type RubricCriterionDraft,
} from '@/components/assignments/rubric';
import { RubricBuilder } from '@/components/assignments/RubricBuilder';
import { QueryErrorState } from '@/components/courses/QueryErrorState';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAssignment, useUpdateAssignment, useUpdateRubric } from '@/hooks/useAssignments';
import { paths } from '@/lib/routes';
import type { Assignment, AssignmentCreateRequest } from '@/types';

function EditAssignmentContent({ assignment }: { assignment: Assignment }) {
  const toast = useToast();
  const navigate = useNavigate();
  const update = useUpdateAssignment(assignment.id);
  const updateRubric = useUpdateRubric(assignment.id);

  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<RubricCriterionDraft[]>(() => criteriaToDrafts(assignment.rubricCriteria));

  const savedRubricJson = useMemo(
    () => JSON.stringify(draftsToInput(criteriaToDrafts(assignment.rubricCriteria))),
    [assignment.rubricCriteria],
  );
  const rubricDirty = JSON.stringify(draftsToInput(drafts)) !== savedRubricJson;

  const handleDetails = (payload: AssignmentCreateRequest) => {
    setDetailsError(null);
    update.mutate(payload, {
      onSuccess: () => toast({ status: 'success', title: 'Details save aachu ✅' }),
      onError: (err) => setDetailsError(assignmentErrorMessage(err)),
    });
  };

  const handleSaveRubric = () => {
    const problem = validateCriteria(drafts);
    if (problem) {
      setRubricError(problem);
      return;
    }
    if (drafts.length === 0) {
      setRubricError('Add at least one criterion.');
      return;
    }
    const total = rubricTotal(drafts);
    if (total !== assignment.maxScore) {
      setRubricError(`Rubric total (${total}) must equal the max score (${assignment.maxScore}).`);
      return;
    }
    setRubricError(null);
    updateRubric.mutate(
      { criteria: draftsToInput(drafts) },
      {
        onSuccess: (updated) => {
          setDrafts(criteriaToDrafts(updated.rubricCriteria));
          toast({ status: 'success', title: 'Rubric save aachu 📏' });
        },
        onError: (err) => setRubricError(assignmentErrorMessage(err)),
      },
    );
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Button
        as={RouterLink}
        to={paths.assignmentDetail(assignment.id)}
        leftIcon={<FiArrowLeft />}
        variant="ghost"
        alignSelf="flex-start"
        size="sm"
      >
        Back to assignment
      </Button>
      <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={4}>
        <VStack align="flex-start" spacing={1} minW={0}>
          <Heading size="xl" wordBreak="break-word">
            Edit assignment
          </Heading>
          <Text color="text.muted">Konjam maathanuma? Tune pannalaam.</Text>
        </VStack>
        <HStack spacing={3} align="flex-start" flexWrap="wrap">
          <Button as={RouterLink} to={paths.assignmentDetail(assignment.id)} leftIcon={<FiEye />} variant="outline">
            View
          </Button>
          <DeleteAssignmentButton
            assignment={assignment}
            onDeleted={() => navigate(paths.courseDetail(assignment.courseId))}
          />
          <PublishButton assignment={assignment} hasUnsavedChanges={rubricDirty} />
        </HStack>
      </Flex>

      <GlassCard hoverable={false}>
        <Heading size="md" mb={4}>
          Details
        </Heading>
        <AssignmentForm
          initialAssignment={assignment}
          onSubmit={handleDetails}
          isSubmitting={update.isPending}
          submitLabel="Save details"
          serverError={detailsError}
        />
      </GlassCard>

      <GlassCard hoverable={false}>
        <VStack align="stretch" spacing={4}>
          <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
            <Heading size="md">Rubric</Heading>
            <Button
              leftIcon={<FiSave />}
              onClick={handleSaveRubric}
              isLoading={updateRubric.isPending}
              isDisabled={!rubricDirty}
            >
              Save rubric
            </Button>
          </Flex>
          <Text fontSize="sm" color="text.muted">
            Points must add up to the saved max score ({assignment.maxScore}). Changed the max score? Save details
            first.
          </Text>
          <RubricBuilder
            criteria={drafts}
            onChange={(next) => {
              setDrafts(next);
              setRubricError(null);
            }}
            maxScore={assignment.maxScore}
            isDisabled={updateRubric.isPending}
          />
          {rubricError && (
            <Alert status="error" borderRadius="xl">
              <AlertIcon />
              <AlertDescription>{rubricError}</AlertDescription>
            </Alert>
          )}
        </VStack>
      </GlassCard>
    </VStack>
  );
}

export default function AssignmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const query = useAssignment(assignmentId);

  return (
    <PageWrapper maxW="4xl">
      {query.isLoading ? (
        <VStack align="stretch" spacing={6} aria-busy="true" aria-label="Loading assignment">
          <Skeleton h="40px" w="50%" />
          <Skeleton h="320px" borderRadius="2xl" />
        </VStack>
      ) : query.isError || !query.data ? (
        <QueryErrorState
          error={query.error ?? new Error('Invalid assignment link.')}
          resource="assignment"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <EditAssignmentContent key={query.data.id} assignment={query.data} />
      )}
    </PageWrapper>
  );
}
