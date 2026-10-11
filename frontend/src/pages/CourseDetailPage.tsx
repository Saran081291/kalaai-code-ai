import {
  Badge,
  Button,
  Flex,
  Heading,
  HStack,
  Skeleton,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { FiArchive, FiAward, FiEdit2, FiPlus, FiZap } from 'react-icons/fi';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { AssignmentList } from '@/components/assignments/AssignmentList';
import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { CourseEditModal } from '@/components/courses/CourseEditModal';
import { JoinCodeBadge } from '@/components/courses/JoinCodeBadge';
import { QueryErrorState } from '@/components/courses/QueryErrorState';
import { StudentTable } from '@/components/courses/StudentTable';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useCourseAssignments } from '@/hooks/useAssignments';
import { useAuth } from '@/hooks/useAuth';
import {
  useArchiveCourse,
  useCourse,
  useCourseStudents,
  useRegenerateJoinCode,
} from '@/hooks/useCourses';
import { paths, ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';

function SectionSkeleton() {
  return (
    <VStack align="stretch" spacing={3} aria-busy="true">
      <Skeleton h="72px" borderRadius="2xl" />
      <Skeleton h="72px" borderRadius="2xl" />
    </VStack>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const editModal = useDisclosure();
  const archiveDialog = useDisclosure();

  const courseQuery = useCourse(courseId);
  const course = courseQuery.data;
  // Admins behave like instructors.
  const canManage = Boolean(course && (course.isInstructor || user?.role === 'admin'));

  const assignmentsQuery = useCourseAssignments(courseId, Boolean(course));
  const studentsQuery = useCourseStudents(courseId, canManage);
  const regenerate = useRegenerateJoinCode(courseId);
  const archive = useArchiveCourse(courseId);

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return (
      <PageWrapper>
        <QueryErrorState error={new Error('Invalid course link.')} resource="course" />
      </PageWrapper>
    );
  }

  if (courseQuery.isLoading) {
    return (
      <PageWrapper>
        <VStack align="stretch" spacing={6} aria-busy="true" aria-label="Loading course">
          <Skeleton h="40px" w="60%" />
          <SkeletonText noOfLines={2} spacing={3} />
          <SectionSkeleton />
        </VStack>
      </PageWrapper>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <PageWrapper>
        <QueryErrorState error={courseQuery.error} resource="course" onRetry={() => void courseQuery.refetch()} />
      </PageWrapper>
    );
  }

  const handleRegenerate = () =>
    regenerate.mutateAsync().then(
      (updated) => toast({ status: 'success', title: `Puthu join code ready: ${updated.joinCode} 🔑` }),
      (err: unknown) =>
        toast({ status: 'error', title: "Couldn't regenerate the code", description: getErrorMessage(err) }),
    );

  const handleArchive = () => {
    archive.mutate(undefined, {
      onSuccess: () => {
        archiveDialog.onClose();
        toast({ status: 'success', title: 'Course archive aachu 📦' });
        navigate(ROUTES.courses);
      },
      onError: (err) => {
        archiveDialog.onClose();
        toast({ status: 'error', title: "Couldn't archive the course", description: getErrorMessage(err) });
      },
    });
  };

  return (
    <PageWrapper>
      <VStack align="stretch" spacing={8}>
        <GlassCard hoverable={false}>
          <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" gap={6}>
            <VStack align="flex-start" spacing={3} minW={0} flex="1">
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme={course.isInstructor ? 'purple' : 'green'}>
                  {course.isInstructor ? 'Teaching' : 'Enrolled'}
                </Badge>
                {course.isArchived && (
                  <Badge colorScheme="gray" variant="outline">
                    Archived
                  </Badge>
                )}
                {course.studentCount !== undefined && (
                  <Text fontSize="sm" color="text.muted">
                    {course.studentCount} {course.studentCount === 1 ? 'student' : 'students'}
                  </Text>
                )}
              </HStack>
              <Heading size="xl" wordBreak="break-word">
                {course.name}
              </Heading>
              {course.description && (
                <Text color="text.muted" whiteSpace="pre-wrap">
                  {course.description}
                </Text>
              )}
              {canManage && (
                <JoinCodeBadge
                  code={course.joinCode}
                  canRegenerate={!course.isArchived}
                  onRegenerate={handleRegenerate}
                  isRegenerating={regenerate.isPending}
                />
              )}
            </VStack>
            <VStack align={{ base: 'stretch', lg: 'flex-end' }} spacing={3} flexShrink={0}>
              <HStack spacing={2} flexWrap="wrap" justify={{ base: 'flex-start', lg: 'flex-end' }}>
                <Button as={RouterLink} to={paths.roastWall(course.id)} leftIcon={<FiZap />} variant="outline">
                  Roast Wall
                </Button>
                <Button as={RouterLink} to={paths.leaderboard(course.id)} leftIcon={<FiAward />} variant="outline">
                  Leaderboard
                </Button>
              </HStack>
              {canManage && (
                <HStack spacing={2} flexWrap="wrap" justify={{ base: 'flex-start', lg: 'flex-end' }}>
                  <Button leftIcon={<FiEdit2 />} variant="ghost" onClick={editModal.onOpen}>
                    Edit
                  </Button>
                  {!course.isArchived && (
                    <Button leftIcon={<FiArchive />} variant="ghost" colorScheme="red" onClick={archiveDialog.onOpen}>
                      Archive
                    </Button>
                  )}
                </HStack>
              )}
            </VStack>
          </Flex>
        </GlassCard>

        <Tabs variant="soft-rounded" isLazy>
          <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
            <TabList gap={2}>
              <Tab>Assignments</Tab>
              {canManage && <Tab>Students</Tab>}
            </TabList>
            {canManage && !course.isArchived && (
              <GradientButton to={paths.assignmentNew(course.id)} leftIcon={<FiPlus />} size="sm">
                New assignment
              </GradientButton>
            )}
          </Flex>
          <TabPanels>
            <TabPanel px={0} pt={6}>
              {assignmentsQuery.isLoading ? (
                <SectionSkeleton />
              ) : assignmentsQuery.isError ? (
                <QueryErrorState
                  error={assignmentsQuery.error}
                  resource="assignment list"
                  onRetry={() => void assignmentsQuery.refetch()}
                />
              ) : (
                <AssignmentList courseId={course.id} assignments={assignmentsQuery.data ?? []} isInstructor={canManage} />
              )}
            </TabPanel>
            {canManage && (
              <TabPanel px={0} pt={6}>
                {studentsQuery.isLoading ? (
                  <SectionSkeleton />
                ) : studentsQuery.isError ? (
                  <QueryErrorState
                    error={studentsQuery.error}
                    resource="student list"
                    onRetry={() => void studentsQuery.refetch()}
                  />
                ) : (
                  <StudentTable students={studentsQuery.data ?? []} />
                )}
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </VStack>

      {canManage && (
        <>
          <CourseEditModal course={course} isOpen={editModal.isOpen} onClose={editModal.onClose} />
          <ConfirmDialog
            isOpen={archiveDialog.isOpen}
            onClose={archiveDialog.onClose}
            onConfirm={handleArchive}
            title="Archive this course?"
            body="Archived courses are read-only: students can't join or submit new work. Existing reviews stay available."
            confirmLabel="Archive"
            isLoading={archive.isPending}
          />
        </>
      )}
    </PageWrapper>
  );
}
