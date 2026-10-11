import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Text } from '@chakra-ui/react';

import type { Review } from '@/types';

export interface InstructorOverrideBannerProps {
  review: Review;
  maxScore: number;
}

/** Shown when an instructor has overridden the AI score. */
export function InstructorOverrideBanner({ review, maxScore }: InstructorOverrideBannerProps) {
  if (review.instructorOverrideScore === null) return null;

  return (
    <Alert status="info" variant="left-accent" borderRadius="xl" alignItems="flex-start" data-testid="override-banner">
      <AlertIcon />
      <Box>
        <AlertTitle>
          Instructor adjusted the score to {review.instructorOverrideScore} / {maxScore}
        </AlertTitle>
        <AlertDescription display="block">
          <Text fontSize="sm">Original AI score: {review.totalScore} / {maxScore}</Text>
          {review.instructorComment && (
            <Text mt={1} whiteSpace="pre-wrap">
              “{review.instructorComment}”
            </Text>
          )}
        </AlertDescription>
      </Box>
    </Alert>
  );
}

export default InstructorOverrideBanner;
