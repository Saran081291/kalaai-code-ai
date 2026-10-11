import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Link, List, ListItem, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import { MotionBox } from '@/components/ui/motion';
import { paths } from '@/lib/routes';
import type { Submission } from '@/types';

export interface FailedReviewsAlertProps {
  submissions: Submission[];
}

/** Lists failed pipeline runs; each links to the result page where the instructor can retry. */
export function FailedReviewsAlert({ submissions }: FailedReviewsAlertProps) {
  if (submissions.length === 0) return null;
  const count = submissions.length;

  return (
    <MotionBox initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}>
      <Alert status="error" variant="left-accent" borderRadius="xl" alignItems="flex-start" data-testid="failed-reviews-alert">
        <AlertIcon mt={1} />
        <Box flex={1} minW={0}>
          <AlertTitle>
            Aiyo! {count} review{count === 1 ? '' : 's'} failed
          </AlertTitle>
          <AlertDescription display="block">
            <Text fontSize="sm" mb={2}>
              Open a submission to see the error and retry the review.
            </Text>
            <List spacing={1.5}>
              {submissions.map((submission) => (
                <ListItem key={submission.id} fontSize="sm">
                  <Link
                    as={RouterLink}
                    to={paths.submissionResult(submission.id)}
                    fontWeight={600}
                    textDecoration="underline"
                    aria-label={`Open and retry ${submission.assignmentTitle ?? `submission ${submission.id}`} by ${submission.studentName ?? 'student'}`}
                  >
                    {submission.studentName ?? 'Student'} — {submission.assignmentTitle ?? `Submission #${submission.id}`}
                  </Link>
                  {submission.courseName && (
                    <Text as="span" color="text.muted">
                      {' '}
                      · {submission.courseName}
                    </Text>
                  )}
                  {submission.errorMessage && (
                    <Text fontSize="xs" color="text.muted" noOfLines={1}>
                      {submission.errorMessage}
                    </Text>
                  )}
                </ListItem>
              ))}
            </List>
          </AlertDescription>
        </Box>
      </Alert>
    </MotionBox>
  );
}

export default FailedReviewsAlert;
