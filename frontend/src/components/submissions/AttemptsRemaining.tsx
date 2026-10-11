import { Box, HStack, Progress, Text } from '@chakra-ui/react';

export interface AttemptsRemainingProps {
  used: number;
  max: number;
}

/** "2 of 3 attempts left" with a progress bar. */
export function AttemptsRemaining({ used, max }: AttemptsRemainingProps) {
  const remaining = Math.max(0, max - used);
  const percentUsed = max > 0 ? Math.min(100, (used / max) * 100) : 100;
  const colorScheme = remaining === 0 ? 'red' : remaining === 1 ? 'orange' : 'green';

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" fontWeight={600}>
          Attempts
        </Text>
        <Text fontSize="sm" color="text.muted" data-testid="attempts-remaining">
          {remaining} of {max} {max === 1 ? 'attempt' : 'attempts'} left
        </Text>
      </HStack>
      <Progress
        value={percentUsed}
        size="sm"
        borderRadius="full"
        colorScheme={colorScheme}
        bg="bg.muted"
        aria-label={`${used} of ${max} attempts used`}
      />
    </Box>
  );
}

export default AttemptsRemaining;
