import { CircularProgress, CircularProgressLabel, Flex, Text, VStack } from '@chakra-ui/react';

export interface ScoreRingProps {
  /** null/undefined → not scored yet. */
  score: number | null | undefined;
  max: number;
  /** Ring diameter, e.g. "120px". */
  size?: string;
  thickness?: string;
  label?: string;
}

function ringColor(percent: number): string {
  if (percent >= 80) return 'green.400';
  if (percent >= 50) return 'brand.400';
  return 'maroon.400';
}

/** Circular score indicator: "score / max". */
export function ScoreRing({ score, max, size = '120px', thickness = '10px', label }: ScoreRingProps) {
  const hasScore = typeof score === 'number';
  const percent = hasScore && max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;

  return (
    <VStack spacing={1}>
      <CircularProgress
        value={percent}
        size={size}
        thickness={thickness}
        color={ringColor(percent)}
        trackColor="bg.muted"
        capIsRound
        aria-label={hasScore ? `Score ${score} out of ${max}` : 'Not scored yet'}
      >
        <CircularProgressLabel>
          <Flex direction="column" align="center" lineHeight={1}>
            <Text fontFamily="heading" fontWeight={800} fontSize="2xl">
              {hasScore ? score : '–'}
            </Text>
            <Text fontSize="xs" color="text.muted">
              / {max}
            </Text>
          </Flex>
        </CircularProgressLabel>
      </CircularProgress>
      {label && (
        <Text fontSize="sm" color="text.muted" fontWeight={500}>
          {label}
        </Text>
      )}
    </VStack>
  );
}

export default ScoreRing;
