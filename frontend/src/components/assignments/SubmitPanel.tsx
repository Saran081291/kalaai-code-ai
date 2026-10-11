import { Button, Flex, Heading, Progress, Text, VStack } from '@chakra-ui/react';
import { FiList, FiUploadCloud } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { paths, ROUTES } from '@/lib/routes';
import type { Assignment } from '@/types';

import { isPast } from './dateUtils';
import { submitBlockReason } from './rules';

export interface SubmitPanelProps {
  assignment: Assignment;
}

/** Student CTA: attempts used + "Submit your code 🚀" (disabled with explanation when blocked). */
export function SubmitPanel({ assignment }: SubmitPanelProps) {
  const used = assignment.myAttemptsCount ?? 0;
  const max = assignment.maxAttempts;
  const reason = submitBlockReason(assignment);
  const late = isPast(assignment.dueDate) && assignment.allowLate;

  return (
    <GlassCard hoverable={false}>
      <VStack align="stretch" spacing={4}>
        <Heading size="sm">Your attempts</Heading>
        <Flex align="baseline" gap={2}>
          <Text fontSize="3xl" fontWeight={800} fontFamily="heading" data-testid="attempts-used">
            {used}/{max}
          </Text>
          <Text color="text.muted">attempts used</Text>
        </Flex>
        <Progress
          value={max > 0 ? Math.min(100, (used / max) * 100) : 0}
          borderRadius="full"
          size="sm"
          colorScheme={used >= max ? 'red' : 'brand'}
          aria-label={`${used} of ${max} attempts used`}
        />
        {reason ? (
          <>
            <GradientButton leftIcon={<FiUploadCloud />} isDisabled fullWidth>
              Submit your code 🚀
            </GradientButton>
            <Text fontSize="sm" color="text.muted" role="note">
              {reason}
            </Text>
          </>
        ) : (
          <>
            <GradientButton to={paths.submit(assignment.id)} leftIcon={<FiUploadCloud />} fullWidth>
              Submit your code 🚀
            </GradientButton>
            {late && (
              <Text fontSize="sm" color="orange.500">
                Past due — late submissions are allowed, but your instructor will see it's late.
              </Text>
            )}
          </>
        )}
        <Button as={RouterLink} to={ROUTES.mySubmissions} variant="ghost" leftIcon={<FiList />} size="sm">
          My submissions
        </Button>
      </VStack>
    </GlassCard>
  );
}

export default SubmitPanel;
