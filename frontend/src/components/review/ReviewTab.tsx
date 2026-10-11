import { Button, Flex, Grid, GridItem, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { FiCode, FiEdit3 } from 'react-icons/fi';

import { GlassCard } from '@/components/ui/GlassCard';
import { MotionBox } from '@/components/ui/motion';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useOverrideReview, useReReview } from '@/hooks/useReview';
import { getErrorMessage } from '@/services/api';
import type { Review, ReviewIssue, ReviewOverrideRequest } from '@/types';

import { CodeViewerModal } from './CodeViewerModal';
import { InstructorOverrideBanner } from './InstructorOverrideBanner';
import { IssueList } from './IssueList';
import { OverrideScoreModal } from './OverrideScoreModal';
import { ReReviewButton } from './ReReviewButton';
import type { CodeTarget } from './reviewUtils';
import { RubricBreakdown } from './RubricBreakdown';
import { StrengthsList } from './StrengthsList';

export interface ReviewTabProps {
  submissionId: number;
  review: Review;
  maxScore: number;
  /** Instructor (not the owner): show override + re-review controls. */
  isInstructor: boolean;
}

/** Score, summary, rubric, strengths, issues and the code viewer. */
export function ReviewTab({ submissionId, review, maxScore, isInstructor }: ReviewTabProps) {
  const toast = useToast();
  const codeViewer = useDisclosure();
  const overrideModal = useDisclosure();
  const [codeTarget, setCodeTarget] = useState<CodeTarget | null>(null);

  const overrideMutation = useOverrideReview(submissionId);
  const reReviewMutation = useReReview(submissionId);

  const openIssue = (issue: ReviewIssue) => {
    setCodeTarget({ file: issue.file, line: issue.line });
    codeViewer.onOpen();
  };

  const openCode = () => {
    setCodeTarget(null);
    codeViewer.onOpen();
  };

  const handleOverride = (body: ReviewOverrideRequest) => {
    overrideMutation.mutate(
      { reviewId: review.id, body },
      {
        onSuccess: () => {
          overrideModal.onClose();
          toast({
            status: 'success',
            title: body.overrideScore === null ? 'Override cleared' : 'Score updated 👍',
          });
        },
        onError: (err) => toast({ status: 'error', title: 'Could not save override', description: getErrorMessage(err) }),
      },
    );
  };

  const handleReReview = () => {
    reReviewMutation.mutate(undefined, {
      onSuccess: () => toast({ status: 'info', title: 'Re-review started 🔁', description: 'Annae thirumba padikkiraaru…' }),
      onError: (err) => toast({ status: 'error', title: 'Could not re-run review', description: getErrorMessage(err) }),
    });
  };

  return (
    <Stack spacing={6}>
      <GlassCard hoverable={false} p={{ base: 4, md: 6 }}>
        <Flex direction={{ base: 'column', sm: 'row' }} gap={6} align={{ base: 'center', sm: 'flex-start' }}>
          <MotionBox
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 220, damping: 16 } }}
            flexShrink={0}
          >
            <ScoreRing
              score={review.effectiveScore}
              max={maxScore}
              size="132px"
              label={review.instructorOverrideScore !== null ? 'Instructor score' : 'AI score'}
            />
          </MotionBox>
          <Stack spacing={3} flex="1" minW={0}>
            <Heading as="h2" size="md">
              Summary
            </Heading>
            <Text whiteSpace="pre-wrap" data-testid="review-summary">
              {review.summary}
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              <Button size="sm" variant="outline" leftIcon={<FiCode />} onClick={openCode}>
                Browse code
              </Button>
              {isInstructor && (
                <Button size="sm" variant="outline" leftIcon={<FiEdit3 />} onClick={overrideModal.onOpen}>
                  Override score
                </Button>
              )}
              {isInstructor && <ReReviewButton onConfirm={handleReReview} isLoading={reReviewMutation.isPending} />}
            </HStack>
          </Stack>
        </Flex>
      </GlassCard>

      <InstructorOverrideBanner review={review} maxScore={maxScore} />

      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={6}>
        <GridItem minW={0}>
          <RubricBreakdown criterionScores={review.criterionScores} />
        </GridItem>
        <GridItem minW={0}>
          <StrengthsList strengths={review.strengths} />
        </GridItem>
      </Grid>

      <IssueList issues={review.issues} onSelectIssue={openIssue} />

      <CodeViewerModal
        isOpen={codeViewer.isOpen}
        onClose={codeViewer.onClose}
        submissionId={submissionId}
        target={codeTarget}
      />
      {isInstructor && (
        <OverrideScoreModal
          isOpen={overrideModal.isOpen}
          onClose={overrideModal.onClose}
          review={review}
          maxScore={maxScore}
          onSubmit={handleOverride}
          isSubmitting={overrideMutation.isPending}
        />
      )}
    </Stack>
  );
}

export default ReviewTab;
