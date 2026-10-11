import { Flex, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import { STATUS_META } from '@/lib/status';

export interface ErrorCardProps {
  /** User-facing reason (e.g. `submission.errorMessage`). */
  message: string | null | undefined;
  title?: string;
  /** e.g. a RetryButton. */
  action?: ReactNode;
}

/** Failed-pipeline card. */
export function ErrorCard({ message, title = 'Review failed', action }: ErrorCardProps) {
  return (
    <GlassCard hoverable={false} borderColor="red.300" role="alert" p={{ base: 5, md: 8 }}>
      <Flex direction="column" align="center" textAlign="center" gap={3}>
        <Text fontSize="5xl" aria-hidden>
          😵
        </Text>
        <Heading as="h2" size="md">
          {title}
        </Heading>
        <Text color="text.muted">{STATUS_META.failed.funLine}</Text>
        <Text
          fontWeight={600}
          bg="bg.subtle"
          borderRadius="lg"
          px={4}
          py={2}
          whiteSpace="pre-wrap"
          wordBreak="break-word"
          data-testid="submission-error"
        >
          {message?.trim() || 'Something went wrong while reviewing this submission.'}
        </Text>
        {action && <Flex mt={2}>{action}</Flex>}
      </Flex>
    </GlassCard>
  );
}

export default ErrorCard;
