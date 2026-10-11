import { Button, Heading, Text, useToast, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { assignmentErrorMessage } from '@/components/assignments/errors';
import { QueryErrorState } from '@/components/courses/QueryErrorState';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useCreateAssignment } from '@/hooks/useAssignments';
import { useCourse } from '@/hooks/useCourses';
import { paths } from '@/lib/routes';
import type { AssignmentCreateRequest } from '@/types';

export default function AssignmentCreatePage() {
  const { courseId: courseIdParam } = useParams<{ courseId: string }>();
  const courseId = Number(courseIdParam);
  const toast = useToast();
  const navigate = useNavigate();
  const courseQuery = useCourse(courseId);
  const create = useCreateAssignment(courseId);
  const [serverError, setServerError] = useState<string | null>(null);

  if (courseQuery.isError) {
    return (
      <PageWrapper>
        <QueryErrorState error={courseQuery.error} resource="course" onRetry={() => void courseQuery.refetch()} />
      </PageWrapper>
    );
  }

  const handleSubmit = (payload: AssignmentCreateRequest) => {
    setServerError(null);
    create.mutate(payload, {
      onSuccess: (assignment) => {
        toast({
          status: 'success',
          title: 'Assignment ready! 📝',
          description: assignment.isPublished ? undefined : 'Saved as a draft — publish it when the rubric is set.',
        });
        navigate(paths.assignmentDetail(assignment.id));
      },
      onError: (err) => setServerError(assignmentErrorMessage(err)),
    });
  };

  return (
    <PageWrapper maxW="4xl">
      <VStack align="stretch" spacing={6}>
        <Button
          as={RouterLink}
          to={paths.courseDetail(courseId)}
          leftIcon={<FiArrowLeft />}
          variant="ghost"
          alignSelf="flex-start"
          size="sm"
        >
          {courseQuery.data ? courseQuery.data.name : 'Back to course'}
        </Button>
        <VStack align="flex-start" spacing={1}>
          <Heading size="xl">New assignment</Heading>
          <Text color="text.muted">Rubric-a ready pannu, students-a ready pannu 😏</Text>
        </VStack>
        <GlassCard hoverable={false}>
          <AssignmentForm
            withRubric
            onSubmit={handleSubmit}
            isSubmitting={create.isPending}
            submitLabel="Create assignment"
            onCancel={() => navigate(paths.courseDetail(courseId))}
            serverError={serverError}
          />
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}
