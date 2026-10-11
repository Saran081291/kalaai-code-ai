import { Button, Heading, HStack, Text, useToast, VStack } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { FiLogIn } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { isValidJoinCode, JOIN_CODE_LENGTH } from '@/components/courses/joinCode';
import { JoinCodeInput } from '@/components/courses/JoinCodeInput';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useJoinCourse } from '@/hooks/useCourses';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorCode, getErrorMessage } from '@/services/api';

function joinErrorMessage(err: unknown): string {
  switch (getErrorCode(err)) {
    case 'INVALID_JOIN_CODE':
      return "That join code doesn't match any course. Double-check it with your instructor.";
    case 'ALREADY_ENROLLED':
      return "You're already enrolled in this course — check your Courses page.";
    default:
      return getErrorMessage(err);
  }
}

export default function CourseJoinPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const join = useJoinCourse();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleChange = (value: string) => {
    setCode(value);
    if (error) setError(undefined);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidJoinCode(code)) {
      setError(`Join code must be exactly ${JOIN_CODE_LENGTH} letters or numbers.`);
      return;
    }
    join.mutate(code, {
      onSuccess: (course) => {
        toast({ status: 'success', title: `Semma! "${course.name}" la join aachu 🎉` });
        navigate(paths.courseDetail(course.id));
      },
      onError: (err) => setError(joinErrorMessage(err)),
    });
  };

  return (
    <PageWrapper maxW="lg">
      <VStack align="stretch" spacing={6}>
        <VStack align="flex-start" spacing={1}>
          <Heading size="xl">Join a course</Heading>
          <Text color="text.muted">Join code-a podu, class-ukulla vaa! 🎒</Text>
        </VStack>
        <GlassCard hoverable={false}>
          <VStack as="form" align="stretch" spacing={6} onSubmit={handleSubmit} noValidate>
            <JoinCodeInput value={code} onChange={handleChange} error={error} isDisabled={join.isPending} />
            <HStack justify="flex-end" spacing={3}>
              <Button variant="ghost" onClick={() => navigate(ROUTES.courses)} isDisabled={join.isPending}>
                Cancel
              </Button>
              <GradientButton type="submit" leftIcon={<FiLogIn />} isLoading={join.isPending}>
                Join course
              </GradientButton>
            </HStack>
          </VStack>
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}
