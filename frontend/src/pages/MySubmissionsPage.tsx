import { Alert, AlertDescription, AlertIcon, Badge, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';

import { PaginationControls, SubmissionsTable } from '@/components/submissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { hasInProgress, useMySubmissions } from '@/hooks/useSubmissions';
import { ROUTES } from '@/lib/routes';
import { getErrorMessage } from '@/services/api';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default function MySubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const query = useMySubmissions(page);
  const data = query.data;

  const setPage = (next: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(next));
      return params;
    });
  };

  let content;
  if (query.isPending) {
    content = <LoadingScreen fullScreen={false} text="Un code history load aagudhu…" />;
  } else if (query.isError) {
    content = (
      <Alert status="error" borderRadius="xl">
        <AlertIcon />
        <AlertDescription>{getErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  } else if (!data || data.total === 0) {
    content = (
      <EmptyState
        emoji="📭"
        title="Innum onnum submit pannala, thambi!"
        description="You have no submissions yet. Pick an assignment from your courses and get roasted 🔥"
        action={<GradientButton to={ROUTES.courses}>Browse courses</GradientButton>}
      />
    );
  } else {
    content = (
      <>
        <SubmissionsTable submissions={data.items} variant="student" />
        <PaginationControls
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
          isDisabled={query.isPlaceholderData}
        />
      </>
    );
  }

  return (
    <PageWrapper>
      <Stack spacing={1} mb={6}>
        <Heading size="xl">My Submissions</Heading>
        <Text color="text.muted">Nee ezhudhuna code history ellam inga irukku.</Text>
        {data && data.total > 0 && (
          <HStack spacing={2}>
            <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={2}>
              {data.total} total
            </Badge>
            {hasInProgress(data) && (
              <HStack spacing={1} color="text.muted" fontSize="sm" aria-live="polite">
                <Spinner size="xs" />
                <Text>Review nadakkudhu — auto-refreshing</Text>
              </HStack>
            )}
          </HStack>
        )}
      </Stack>
      {content}
    </PageWrapper>
  );
}
