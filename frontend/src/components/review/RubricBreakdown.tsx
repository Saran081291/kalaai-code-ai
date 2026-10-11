import { Box, Flex, Heading, Progress, Stack, Text } from '@chakra-ui/react';

import { AnimatedList } from '@/components/ui/AnimatedList';
import { GlassCard } from '@/components/ui/GlassCard';
import type { ReviewCriterionScore } from '@/types';

export interface RubricBreakdownProps {
  criterionScores: ReviewCriterionScore[];
}

function scoreColor(percent: number): string {
  if (percent >= 80) return 'green';
  if (percent >= 50) return 'brand';
  return 'red';
}

/** Per-criterion score bar + AI feedback. */
export function RubricBreakdown({ criterionScores }: RubricBreakdownProps) {
  return (
    <Box as="section" aria-labelledby="rubric-heading">
      <Heading id="rubric-heading" as="h3" size="md" mb={3}>
        Rubric breakdown
      </Heading>
      {criterionScores.length === 0 ? (
        <Text color="text.muted">No rubric scores for this review.</Text>
      ) : (
        <AnimatedList spacing={3}>
          {criterionScores.map((criterion) => {
            const name = criterion.criterionName ?? `Criterion #${criterion.criterionId}`;
            const max = criterion.maxPoints ?? 0;
            const percent = max > 0 ? Math.min(100, (criterion.score / max) * 100) : 0;
            return (
              <GlassCard key={criterion.id} p={4} hoverable data-testid="rubric-criterion">
                <Stack spacing={2}>
                  <Flex justify="space-between" align="baseline" gap={3}>
                    <Text fontWeight={700}>{name}</Text>
                    <Text fontWeight={700} fontFamily="mono" flexShrink={0}>
                      {criterion.score}
                      {max > 0 ? ` / ${max}` : ''}
                    </Text>
                  </Flex>
                  <Progress
                    value={percent}
                    colorScheme={scoreColor(percent)}
                    borderRadius="full"
                    size="sm"
                    bg="bg.muted"
                    aria-label={`${name}: ${criterion.score}${max > 0 ? ` out of ${max}` : ''}`}
                  />
                  {criterion.feedback && (
                    <Text color="text.muted" fontSize="sm" whiteSpace="pre-wrap">
                      {criterion.feedback}
                    </Text>
                  )}
                </Stack>
              </GlassCard>
            );
          })}
        </AnimatedList>
      )}
    </Box>
  );
}

export default RubricBreakdown;
