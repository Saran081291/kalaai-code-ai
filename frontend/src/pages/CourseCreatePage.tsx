import { Heading, Text, useToast, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

import { CourseForm } from '@/components/courses/CourseForm';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useCreateCourse } from '@/hooks/useCourses';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';
import type { CourseCreateRequest } from '@/types';

export default function CourseCreatePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const create = useCreateCourse();

  const handleSubmit = (values: CourseCreateRequest) => {
    create.mutate(values, {
      onSuccess: (course) => {
        toast({ status: 'success', title: 'Semma! Course create aachu 🎉', description: `Join code: ${course.joinCode}` });
        navigate(paths.courseDetail(course.id));
      },
      onError: (err) => {
        toast({ status: 'error', title: "Couldn't create the course", description: getErrorMessage(err) });
      },
    });
  };

  return (
    <PageWrapper maxW="2xl">
      <VStack align="stretch" spacing={6}>
        <VStack align="flex-start" spacing={1}>
          <Heading size="xl">New course</Heading>
          <Text color="text.muted">Puthu course start panlaama, annae? You'll get a join code to share.</Text>
        </VStack>
        <GlassCard hoverable={false}>
          <CourseForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending}
            submitLabel="Create course"
            onCancel={() => navigate(ROUTES.courses)}
          />
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}
