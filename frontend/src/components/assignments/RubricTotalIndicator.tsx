import { Flex, Icon, Text } from '@chakra-ui/react';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

export interface RubricTotalIndicatorProps {
  total: number;
  maxScore: number;
}

/** Live "rubric total vs max score" pill — green when equal, warning otherwise. */
export function RubricTotalIndicator({ total, maxScore }: RubricTotalIndicatorProps) {
  const matches = total === maxScore;
  const diff = Math.abs(maxScore - total);
  const hint = matches
    ? 'Matches max score'
    : total < maxScore
      ? `${diff} ${diff === 1 ? 'point' : 'points'} short`
      : `${diff} ${diff === 1 ? 'point' : 'points'} over`;

  return (
    <Flex
      role="status"
      aria-live="polite"
      data-state={matches ? 'match' : 'mismatch'}
      align="center"
      gap={2}
      px={3}
      py={2}
      borderRadius="xl"
      borderWidth="1px"
      bg={matches ? 'green.50' : 'orange.50'}
      borderColor={matches ? 'green.200' : 'orange.200'}
      color={matches ? 'green.700' : 'orange.700'}
      _dark={{
        bg: matches ? 'rgba(72, 187, 120, 0.12)' : 'rgba(237, 137, 54, 0.12)',
        borderColor: matches ? 'green.700' : 'orange.700',
        color: matches ? 'green.200' : 'orange.200',
      }}
    >
      <Icon as={matches ? FiCheckCircle : FiAlertTriangle} aria-hidden />
      <Text fontWeight={700}>
        Rubric total: {total} / {maxScore}
      </Text>
      <Text fontSize="sm">— {hint}</Text>
    </Flex>
  );
}

export default RubricTotalIndicator;
