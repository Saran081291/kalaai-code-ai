import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';

import {
  PaginationControls,
  SubmissionStatusFilter,
  SubmissionsTable,
  type StatusFilterValue,
} from '@/components/submissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { hasInProgress, useAssignmentSubmissions, useSubmissionAssignment } from '@/hooks/useSubmissions';
import { paths } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default function AssignmentSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');

  const assignmentQuery = useSubmissionAssignment(assignmentId);
  const submissionsQuery = useAssignmentSubmissions(assignmentId, page);

  const setPage = (next: number) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('page', String(next));
        return params;
      },
      { replace: false },
    );
  };

  const data = submissionsQuery.data;
  const items = data?.items ?? [];
  const visible = statusFilter === 'all' ? items : items.filter((item) => item.status === statusFilter);
  const isPolling = hasInProgress(data);

  let content;
  if (submissionsQuery.isPending) {
    content = <LoadingScreen fullScreen={false} text="Submissions load aagudhu…" />;
  } else if (submissionsQuery.isError) {
    content = (
      <Alert status="error" borderRadius="xl">
        <AlertIcon />
        <AlertDescription>{getErrorMessage(submissionsQuery.error)}</AlertDescription>
      </Alert>
    );
  } else if (data && data.total === 0) {
    content = (
      <EmptyState
        emoji="😴"
        title="Innum yaarum submit pannala 😴"
        description="No submissions yet. Students' code will show up here as soon as they submit."
      />
    );
  } else {
    content = (
      <>
        {visible.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="No submissions match this filter"
            description="Indha status-la onnum illa on this page. Try another filter."
          />
        ) : (
          <SubmissionsTable submissions={visible} variant="instructor" />
        )}
        {data && (
          <PaginationControls
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
            isDisabled={submissionsQuery.isPlaceholderData}
          />
        )}
      </>
    );
  }

  return (
    <PageWrapper>
      <Button
        as={RouterLink}
        to={paths.assignmentDetail(Number.isFinite(assignmentId) ? assignmentId : 0)}
        variant="ghost"
        size="sm"
        leftIcon={<FiArrowLeft aria-hidden />}
        mb={4}
      >
        Back to assignment
      </Button>

      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'end' }}
        gap={4}
        mb={6}
      >
        <Stack spacing={1}>
          <Heading size="xl">Submissions</Heading>
          <Text color="text.muted">
            {assignmentQuery.data ? assignmentQuery.data.title : 'Yaar yaar enna submit panninaanga-nu paaru.'}
          </Text>
          <HStack spacing={2}>
            {data && (
              <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={2}>
                {data.total} total
              </Badge>
            )}
            {isPolling && (
              <HStack spacing={1} color="text.muted" fontSize="sm" aria-live="polite">
                <Spinner size="xs" />
                <Text>Live — refreshing every 5s</Text>
              </HStack>
            )}
          </HStack>
        </Stack>
        <SubmissionStatusFilter value={statusFilter} onChange={setStatusFilter} />
      </Flex>

      {content}
    </PageWrapper>
  );
}
