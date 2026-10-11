import {
  Box,
  Flex,
  Heading,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Text,
} from '@chakra-ui/react';
import { useReducedMotion } from 'framer-motion';

import { GlassCard } from '@/components/ui/GlassCard';
import { MotionBox } from '@/components/ui/motion';
import { STATUS_META } from '@/lib/status';
import type { SubmissionStatus } from '@/types';

import { activeStepIndex, PIPELINE_STEPS } from './reviewUtils';

export interface PipelineProgressProps {
  status: SubmissionStatus;
}

/** Vertical stepper shown while the AI pipeline runs, with the fun Tanglish line for the current step. */
export function PipelineProgress({ status }: PipelineProgressProps) {
  const reduceMotion = useReducedMotion();
  const active = activeStepIndex(status);
  const funLine = STATUS_META[status].funLine;

  return (
    <GlassCard hoverable={false} p={{ base: 5, md: 8 }}>
      <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 6, md: 10 }} align={{ base: 'stretch', md: 'center' }}>
        <Flex direction="column" align="center" textAlign="center" gap={3} flex="1">
          <MotionBox
            fontSize={{ base: '5xl', md: '6xl' }}
            aria-hidden
            animate={
              reduceMotion
                ? undefined
                : {
                    scale: [1, 1.18, 1],
                    rotate: [0, -6, 6, 0],
                    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          >
            {status === 'roasting' ? '🌶️' : '🔥'}
          </MotionBox>
          <Heading as="h2" size="md">
            Review nadandhutu irukku…
          </Heading>
          <Box role="status" aria-live="polite" aria-atomic="true">
            <Text color="text.accent" fontWeight={600} fontSize="lg" data-testid="pipeline-fun-line">
              {funLine}
            </Text>
          </Box>
          <Text color="text.muted" fontSize="sm">
            This page updates automatically — no need to refresh.
          </Text>
        </Flex>

        <Box flex="1">
          <Stepper
            index={active}
            orientation="vertical"
            height={{ base: 'auto', md: '280px' }}
            gap={0}
            colorScheme="brand"
            aria-label="Review pipeline progress"
          >
            {PIPELINE_STEPS.map((step, index) => (
              <Step key={step.status} aria-current={index === active ? 'step' : undefined}>
                <StepIndicator>
                  <StepStatus complete={<StepIcon />} incomplete={<StepNumber />} active={<StepNumber />} />
                </StepIndicator>
                <Box flexShrink={0} pb={6}>
                  <StepTitle>{step.title}</StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </Box>
      </Flex>
    </GlassCard>
  );
}

export default PipelineProgress;
