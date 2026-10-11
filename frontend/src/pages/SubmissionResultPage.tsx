import { Alert, AlertDescription, AlertIcon, Button, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ErrorCard } from '@/components/review/ErrorCard';
import { PipelineProgress } from '@/components/review/PipelineProgress';
import { RetryButton } from '@/components/review/RetryButton';
import { ReviewTab } from '@/components/review/ReviewTab';
import { SubmissionHeader } from '@/components/review/SubmissionHeader';
import { RoastTab } from '@/components/roast/RoastTab';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientButton } from '@/components/ui/GradientButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageWrapper } from '@/components/ui/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import { useReview, useRoast } from '@/hooks/useReview';
import { useSubmissionAssignment, useSubmissionStatus } from '@/hooks/useSubmissionStatus';
import { ROUTES } from '@/lib/routes';
import { getErrorMessage, getErrorStatus } from '@/services/api';

const DEFAULT_MAX_SCORE = 100;
type ResultTab = 'review' | 'roast';
const TAB_ORDER: ResultTab[] = ['review', 'roast'];

function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** /submissions/:id — live pipeline status, then the AI review + Madurai roast. */
export default function SubmissionResultPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const submissionId = parseId(rawId);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const submissionQuery = useSubmissionStatus(submissionId);
  const submission = submissionQuery.data;
  const { pollingTimedOut, restartPolling } = submissionQuery;
  const assignmentQuery = useSubmissionAssignment(submission?.assignmentId);
  const isCompleted = submission?.status === 'completed';
  const reviewQuery = useReview(submissionId ?? 0, submissionId !== undefined && isCompleted);
  const roastQuery = useRoast(submissionId ?? 0, submissionId !== undefined && isCompleted);

  const activeTab: ResultTab = searchParams.get('tab') === 'roast' ? 'roast' : 'review';
  const handleTabChange = (index: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (TAB_ORDER[index] === 'roast') next.set('tab', 'roast');
        else next.delete('tab');
        return next;
      },
      { replace: true },
    );
  };

  if (submissionId === undefined) {
    return (
      <PageWrapper>
        <EmptyState
          emoji="🤔"
          title="Submission not found"
          description="Indha link-la edho thappu irukku."
          action={<GradientButton to={ROUTES.dashboard}>Go to dashboard</GradientButton>}
        />
      </PageWrapper>
    );
  }

  if (submissionQuery.isLoading) {
    return <LoadingScreen fullScreen={false} text="Submission-a thedi edukkuren… 🔍" />;
  }

  if (submissionQuery.isError || !submission) {
    const status = getErrorStatus(submissionQuery.error);
    return (
      <PageWrapper>
        {status === 404 || status === 403 ? (
          <EmptyState
            emoji="🙈"
            title={status === 404 ? 'Submission not found' : 'You cannot view this submission'}
            description={getErrorMessage(submissionQuery.error)}
            action={<GradientButton to={ROUTES.dashboard}>Go to dashboard</GradientButton>}
          />
        ) : (
          <Alert status="error" borderRadius="xl" flexWrap="wrap" gap={2}>
            <AlertIcon />
            <AlertDescription flex="1">{getErrorMessage(submissionQuery.error)}</AlertDescription>
            <Button size="sm" onClick={() => void submissionQuery.refetch()}>
              Try again
            </Button>
          </Alert>
        )}
      </PageWrapper>
    );
  }

  const isOwner = user?.id === submission.studentId;
  const isInstructor = !isOwner && (user?.role === 'instructor' || user?.role === 'admin');
  const review = reviewQuery.data ?? null;
  const maxScore =
    review?.maxScore ?? assignmentQuery.data?.maxScore ?? submission.maxScore ?? DEFAULT_MAX_SCORE;

  return (
    <PageWrapper>
      <SubmissionHeader
        submission={submission}
        assignment={assignmentQuery.data}
        isAssignmentLoading={assignmentQuery.isLoading}
        showStudent={isInstructor}
      />

      {submission.status === 'failed' && (
        <ErrorCard
          message={submission.errorMessage}
          action={isOwner || isInstructor ? <RetryButton submissionId={submission.id} /> : undefined}
        />
      )}

      {submission.status !== 'failed' && !isCompleted && <PipelineProgress status={submission.status} />}

      {pollingTimedOut && (
        <Alert status="warning" borderRadius="xl" alignItems="center">
          <AlertIcon />
          <AlertDescription flex="1">
            Taking longer than expected. Review innum mudiyala, thambi. Refresh to check again.
          </AlertDescription>
          <Button size="sm" colorScheme="orange" onClick={restartPolling}>
            Refresh
          </Button>
        </Alert>
      )}

      {isCompleted && (
        <Tabs
          index={TAB_ORDER.indexOf(activeTab)}
          onChange={handleTabChange}
          variant="soft-rounded"
          colorScheme="brand"
          isLazy
        >
          <TabList gap={2} mb={4} aria-label="Result sections">
            <Tab>
              Review <span aria-hidden>&nbsp;📋</span>
            </Tab>
            <Tab>
              Roast <span aria-hidden>&nbsp;🔥</span>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              {reviewQuery.isLoading ? (
                <LoadingScreen fullScreen={false} text="Review load aagudhu… 📋" />
              ) : reviewQuery.isError ? (
                <Alert status="error" borderRadius="xl">
                  <AlertIcon />
                  {getErrorMessage(reviewQuery.error, 'Could not load the review.')}
                </Alert>
              ) : review ? (
                <ReviewTab
                  submissionId={submission.id}
                  review={review}
                  maxScore={maxScore}
                  isInstructor={isInstructor}
                />
              ) : (
                <EmptyState
                  emoji="⏳"
                  title="Review innum ready aagala"
                  description="The review is not available yet. Konjam neram kazhichu refresh pannunga."
                />
              )}
            </TabPanel>
            <TabPanel px={0}>
              <RoastTab
                submissionId={submission.id}
                roast={roastQuery.data}
                isLoading={roastQuery.isLoading}
                error={roastQuery.error}
                isOwner={isOwner}
                isInstructor={isInstructor}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </PageWrapper>
  );
}
